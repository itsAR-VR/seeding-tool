import "server-only";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/config";
import { decrypt } from "@/lib/encryption";
import { getGmailAccessToken } from "@/lib/gmail/token";
import { resolveProviderCredential } from "@/lib/integrations/state";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Sign-in links for invites. Supabase only makes the one-time token; the email
 * goes out through a connected Gmail inbox (Supabase's built-in mailer can't
 * reach people outside the project team). The link opens a "Continue" page
 * (`continuePath`) rather than signing in directly, because email scanners
 * open links and would use up the one-time token. Pressing Continue proves
 * the person owns the address and signs them in.
 */

export class EmailLinkError extends Error {}

/** A Supabase one-time link token for this email, creating the login if needed. */
async function makeSignInUrl(email: string, continuePath: string): Promise<string> {
  const admin = getSupabaseAdmin();
  // New people get an "invite" token (verifying it confirms the email);
  // people who already have a login get a magic link.
  let result = await admin.auth.admin.generateLink({ type: "invite", email });
  if (result.error && /already|exists|registered/i.test(result.error.message)) {
    result = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }
  if (result.error || !result.data.properties?.hashed_token) {
    throw new EmailLinkError(result.error?.message ?? "Couldn't make a sign-in link");
  }
  const { hashed_token, verification_type } = result.data.properties;
  const params = new URLSearchParams({ token_hash: hashed_token, type: verification_type });
  return `${APP_URL}${continuePath}?${params.toString()}`;
}

/** The first connected Gmail inbox among these brands (primary inbox first). */
async function findSender(brandIds: string[]) {
  if (brandIds.length === 0) return null;
  const aliases = await prisma.emailAlias.findMany({
    where: { brandId: { in: brandIds }, isPaused: false },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { address: true, displayName: true, brandId: true, encryptedRefreshToken: true },
  });
  for (const alias of aliases) {
    try {
      const refreshToken = alias.encryptedRefreshToken
        ? decrypt(alias.encryptedRefreshToken)
        : (await resolveProviderCredential(alias.brandId, "gmail")).decryptedValue;
      if (refreshToken) return { ...alias, refreshToken };
    } catch {
      // This inbox isn't connected; try the next one.
    }
  }
  return null;
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type InviteSender = { brandId: string | null; invitedById: string | null };

/** Send a plain-text email from the inviting company's Gmail. */
async function sendFromCompanyGmail(to: string, subject: string, body: string, from: InviteSender) {
  const brandIds = from.brandId
    ? [from.brandId]
    : from.invitedById
      ? (
          await prisma.brandMembership.findMany({
            where: { userId: from.invitedById },
            select: { brandId: true },
          })
        ).map((m) => m.brandId)
      : [];
  const sender = await findSender(brandIds);
  if (!sender) throw new EmailLinkError("No connected Gmail inbox to send from");

  const clean = (v: string) => v.replace(/[\r\n"]/g, "");
  // Non-ASCII header text (accents, emoji) must be encoded or mail apps garble it.
  const header = (v: string) =>
    /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`;
  // Encoded names must not sit inside quotes (RFC 2047).
  const quotedName = (v: string) => (header(v) === v ? `"${v}"` : header(v));
  const fromHeader = sender.displayName
    ? `${quotedName(clean(sender.displayName))} <${sender.address}>`
    : sender.address;
  const raw = [
    `From: ${fromHeader}`,
    `To: ${clean(to)}`,
    `Subject: ${header(clean(subject))}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body.replace(/\r?\n/g, "\r\n"),
  ].join("\r\n");

  const accessToken = await getGmailAccessToken(sender.refreshToken);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(raw) }),
  });
  if (!res.ok) throw new EmailLinkError(`Gmail send failed (${res.status})`);
}

/** Email the invite link itself, right after the invite is created. */
export async function sendInviteEmail(params: InviteSender & { email: string; link: string; companyName: string }) {
  const intro = params.brandId
    ? `You've been invited to join ${params.companyName} on Seed Scale, where the team runs its creator gifting.`
    : `You've been invited to set up ${params.companyName} on Seed Scale to run your creator gifting.`;
  await sendFromCompanyGmail(
    params.email,
    `You're invited to ${params.companyName} on Seed Scale`,
    `Hi,\n\n${intro}\n\nOpen this link to get started:\n\n${params.link}\n\nThe link expires in 14 days.`,
    params,
  );
}

/**
 * Email a one-time sign-in link to `email`, which proves they own the address.
 */
export async function sendSignInLink(params: InviteSender & {
  email: string;
  /** Same-site page with the Continue button, e.g. /invite/<token>/continue. */
  continuePath: string;
  companyName: string;
}): Promise<void> {
  const link = await makeSignInUrl(params.email, params.continuePath);
  await sendFromCompanyGmail(
    params.email,
    `Your link to join ${params.companyName} on Seed Scale`,
    `Hi,\n\nOpen this link to join ${params.companyName} on Seed Scale:\n\n${link}\n\nIt works once and expires in about an hour. If you didn't ask for this, you can ignore this email.`,
    params,
  );
}
