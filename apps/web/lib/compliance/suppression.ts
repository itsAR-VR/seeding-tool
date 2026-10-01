import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Consent suppression service.
 *
 * Uses Creator.optedOut + optOutDate fields as the primary suppression mechanism.
 * Also writes to the durable EmailSuppression table so that emails NOT in the
 * Creator table can still be suppressed (e.g. one-click unsubscribe from unknown
 * recipients).
 *
 * // INVARIANT: Suppressed recipients never receive email — checked before every send
 */

/** Reasons that apply to every brand: the address itself is bad or reported us. */
const GLOBAL_REASONS = new Set(["BOUNCE", "COMPLAINT"]);

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if an email address is suppressed for a brand.
 * True when the person opted out of THIS brand, or the address is blocked for
 * every brand (bounce/complaint). A "no" to one brand never blocks another.
 */
export async function isSuppressed(email: string, brandId: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = normalize(email);

  const creator = await prisma.creator.findFirst({
    where: { brandId, email: normalizedEmail, optedOut: true },
    select: { id: true },
  });
  if (creator) return true;

  const suppression = await prisma.emailSuppression.findFirst({
    where: { email: normalizedEmail, OR: [{ brandId }, { brandId: null }] },
    select: { id: true },
  });
  return !!suppression;
}

/**
 * Suppress an email for one brand (opt-outs, "no" decisions), or for every
 * brand when brandId is null (bounces, complaints).
 */
export async function addSuppression(
  email: string,
  reason: string,
  brandId: string | null
): Promise<void> {
  const normalizedEmail = normalize(email);
  const scope = GLOBAL_REASONS.has(reason) ? null : brandId;
  // brandId null with a per-brand reason = a global block (e.g. an old link
  // from someone we can't match to a brand).

  // One row per reason, so undoing a "no" can't lift an unsubscribe.
  const existing = await prisma.emailSuppression.findFirst({
    where: { email: normalizedEmail, brandId: scope, reason },
    select: { id: true },
  });
  if (!existing) {
    await prisma.emailSuppression.create({
      data: { email: normalizedEmail, reason, brandId: scope, suppressedAt: new Date() },
    });
  }

  const creatorScope = scope ? { brandId: scope } : {};
  await prisma.creator.updateMany({
    where: { email: normalizedEmail, ...creatorScope },
    data: { optedOut: true, optOutDate: new Date() },
  });

  const creators = await prisma.creator.findMany({
    where: { email: normalizedEmail, ...creatorScope },
    select: { id: true },
  });
  if (creators.length > 0) {
    await prisma.campaignCreator.updateMany({
      where: {
        creatorId: { in: creators.map((c) => c.id) },
        lifecycleStatus: { notIn: ["completed", "opted_out"] },
      },
      data: { lifecycleStatus: "opted_out" },
    });
  }
}

/**
 * Lift one brand's suppression of a given reason (e.g. undoing a "no"),
 * leaving other brands and global blocks untouched.
 */
export async function removeSuppression(
  email: string,
  reason: string,
  brandId: string
): Promise<void> {
  const normalizedEmail = normalize(email);
  const { count } = await prisma.emailSuppression.deleteMany({
    where: { email: normalizedEmail, brandId, reason },
  });
  if (count === 0) return;
  // Still blocked for another reason (an unsubscribe, a bounce): stay opted out.
  const stillBlocked = await prisma.emailSuppression.findFirst({
    where: { email: normalizedEmail, OR: [{ brandId }, { brandId: null }] },
    select: { id: true },
  });
  if (!stillBlocked) {
    await prisma.creator.updateMany({
      where: { email: normalizedEmail, brandId },
      data: { optedOut: false, optOutDate: null },
    });
  }
}

/**
 * Returns the APP_ENCRYPTION_KEY or throws if unset.
 * SECURITY: Never fall back to empty string — that makes all HMACs forgeable.
 */
function getEncryptionKey(): string {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Cannot generate or verify HMAC tokens."
    );
  }
  return key;
}

function hmac(value: string): string {
  return createHmac("sha256", getEncryptionKey()).update(value).digest("hex");
}

/**
 * Generate an HMAC token for an unsubscribe link. With a brandId the token is
 * bound to that brand; without one it's the legacy email-only token.
 */
export function generateUnsubscribeToken(email: string, brandId?: string): string {
  const normalizedEmail = normalize(email);
  return hmac(brandId ? `${normalizedEmail}|${brandId}` : normalizedEmail);
}

/**
 * Verify an HMAC unsubscribe token using constant-time comparison.
 * SECURITY: Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyUnsubscribeToken(email: string, token: string, brandId?: string): boolean {
  const expectedBuf = Buffer.from(generateUnsubscribeToken(email, brandId));
  const tokenBuf = Buffer.from(token);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Custom error thrown when attempting to send to a suppressed recipient.
 */
export class SuppressedRecipientError extends Error {
  public readonly email: string;

  constructor(email: string) {
    super(`Cannot send to suppressed recipient: ${email}`);
    this.name = "SuppressedRecipientError";
    this.email = email;
  }
}
