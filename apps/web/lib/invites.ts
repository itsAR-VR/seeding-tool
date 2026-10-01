import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/config";

/** Invites stay valid for 14 days. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export class InviteError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteLink(token: string): string {
  return `${APP_URL}/invite/${token}`;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Platform admins (who can invite new companies) come from PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
  return admins.includes(normalizeEmail(email));
}

export async function createInvite(params: {
  email: string;
  role: "owner" | "editor" | "viewer";
  brandId: string | null;
  companyName?: string | null;
  invitedById: string | null;
}): Promise<{ id: string; link: string }> {
  const email = normalizeEmail(params.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InviteError("Enter a valid email address.");
  if (!params.brandId && !params.companyName?.trim()) throw new InviteError("Enter the company name.");

  if (params.brandId) {
    const already = await prisma.brandMembership.findFirst({
      where: { brandId: params.brandId, user: { email } },
      select: { id: true },
    });
    if (already) throw new InviteError("That person is already on this team.");
  }

  // One live invite per email and company: revoke older ones.
  await prisma.brandInvite.updateMany({
    where: { email, brandId: params.brandId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = randomBytes(24).toString("base64url");
  const invite = await prisma.brandInvite.create({
    data: {
      email,
      role: params.role,
      brandId: params.brandId,
      companyName: params.companyName?.trim() || null,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedById: params.invitedById,
    },
  });
  return { id: invite.id, link: inviteLink(token) };
}

/** A usable invite for this token, or an error explaining why not. */
export async function findUsableInvite(token: string) {
  const invite = await prisma.brandInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { brand: { select: { id: true, name: true, logoUrl: true } } },
  });
  if (!invite || invite.revokedAt) throw new InviteError("This invite link isn't valid. Ask for a new one.", 404);
  if (invite.acceptedAt) throw new InviteError("This invite was already used. Sign in instead.", 410);
  if (invite.expiresAt < new Date()) throw new InviteError("This invite expired. Ask for a new one.", 410);
  return invite;
}

/**
 * A company invite that was accepted but hasn't created its company yet. Lets
 * the onboarding wizard create exactly one brand for this person.
 */
export async function findOpenCompanyInvite(email: string) {
  return prisma.brandInvite.findFirst({
    where: { email: normalizeEmail(email), brandId: null, acceptedAt: { not: null }, revokedAt: null },
    orderBy: { acceptedAt: "desc" },
  });
}
