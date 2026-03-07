import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

/**
 * Consent suppression service.
 *
 * Uses Creator.optedOut + optOutDate fields as the suppression mechanism.
 * The schema has no separate ConsentSuppression table — Creator is the
 * canonical source of opt-out state.
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

  const creator = await prisma.creator.findFirst({
    where: {
      email: normalizedEmail,
      optedOut: true,
    },
    select: { id: true },
  });

  return !!creator;
}

/**
 * Add suppression for a creator by email.
 *
 * @param email - The email to suppress
 * @param _reason - Reason for suppression (logged, not stored separately)
 */
export async function addSuppression(
  email: string,
  _reason: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

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
 * Generate an HMAC token for unsubscribe links.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.APP_ENCRYPTION_KEY || "";
  return createHmac("sha256", secret)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verify an HMAC unsubscribe token.
 */
export function verifyUnsubscribeToken(
  email: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(email);
  return token === expected;
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
