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

/**
 * Check if an email address is suppressed (opted out).
 * Returns true if the email should NOT receive any outbound messages.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase().trim();

  // Check Creator-based suppression
  const creator = await prisma.creator.findFirst({
    where: {
      email: normalizedEmail,
      optedOut: true,
    },
    select: { id: true },
  });

  if (creator) return true;

  // Check durable EmailSuppression table (for emails not in Creator table)
  const suppression = await prisma.emailSuppression.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  return !!suppression;
}

/**
 * Add suppression for a creator by email.
 *
 * @param email - The email to suppress
 * @param _reason - Reason for suppression (logged, not stored separately)
 */
export async function addSuppression(
  email: string,
  reason: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Write to durable EmailSuppression table (upsert — idempotent)
  await prisma.emailSuppression.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      reason,
      suppressedAt: new Date(),
    },
    update: {}, // Already suppressed — no-op
  });

  // Update all Creator records matching this email
  await prisma.creator.updateMany({
    where: { email: normalizedEmail },
    data: {
      optedOut: true,
      optOutDate: new Date(),
    },
  });

  // Also update any CampaignCreator lifecycleStatus to opted_out
  const creators = await prisma.creator.findMany({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (creators.length > 0) {
    await prisma.campaignCreator.updateMany({
      where: {
        creatorId: { in: creators.map((c) => c.id) },
        lifecycleStatus: {
          notIn: ["completed", "opted_out"],
        },
      },
      data: { lifecycleStatus: "opted_out" },
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

/**
 * Generate an HMAC token for unsubscribe links.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = getEncryptionKey();
  return createHmac("sha256", secret)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verify an HMAC unsubscribe token using constant-time comparison.
 * SECURITY: Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(email);

  // timingSafeEqual requires buffers of equal length
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

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
