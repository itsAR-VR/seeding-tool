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
 * reach people outside the project team). Opening the link proves the person
 * owns the address, signs them in, and brings them to `next`.
 */

export class EmailLinkError extends Error {}

/** A Supabase one-time link token for this email, creating the login if needed. */
async function makeSignInUrl(email: string, next: string): Promise<string> {
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
  const params = new URLSearchParams({ token_hash: hashed_token, type: verification_type, next });
  return `${APP_URL}/callback?${params.toString()}`;
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

/**
 * Email a sign-in link to `email`. Sent from the inviting company's inbox,
 * or the inviter's own company when the invite is for a new company.
 */
export async function sendSignInLink(params: {
  email: string;
  next: string;
  companyName: string;
  brandId: string | null;
  invitedById: string | null;
}): Promise<void> {
  const brandIds = params.brandId
    ? [params.brandId]
    : params.invitedById
      ? (
          await prisma.brandMembership.findMany({
            where: { userId: params.invitedById },
            select: { brandId: true },
          })
        ).map((m) => m.brandId)
      : [];
  const sender = await findSender(brandIds);
  if (!sender) throw new EmailLinkError("No connected Gmail inbox to send the link from");

  const link = await makeSignInUrl(params.email, params.next);
  const clean = (v: string) => v.replace(/[\r\n"]/g, "");
  const from = sender.displayName ? `"${clean(sender.displayName)}" <${sender.address}>` : sender.address;
  const raw = [
    `From: ${from}`,
    `To: ${clean(params.email)}`,
    `Subject: ${clean(`Your link to join ${params.companyName} on Seed Scale`)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    `Hi,\r\n\r\nOpen this link to join ${params.companyName} on Seed Scale:\r\n\r\n${link}\r\n\r\nIt works once and expires in about an hour. If you didn't ask for this, you can ignore this email.`,
  ].join("\r\n");

  const accessToken = await getGmailAccessToken(sender.refreshToken);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(raw) }),
  });
  if (!res.ok) throw new EmailLinkError(`Gmail send failed (${res.status})`);
}
