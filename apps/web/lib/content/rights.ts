import { randomBytes } from "crypto";
import { APP_URL } from "@/lib/config";
import { DEFAULT_RIGHTS_MONTHS, RIGHTS_DURATIONS, isValidRightsMonths } from "./rights-options";

export { DEFAULT_RIGHTS_MONTHS, RIGHTS_DURATIONS, isValidRightsMonths };

/** Bump when the wording of the terms changes, so each approval records what was shown. */
export const RIGHTS_TERMS_VERSION = "v1";


export function newRightsToken(): string {
  return randomBytes(24).toString("base64url");
}

export function rightsLink(token: string): string {
  return `${APP_URL}/rights/${token}`;
}

export function rightsDurationPhrase(months: number): string {
  return months === 0 ? "with no end date" : `for ${months} months from today`;
}

/** Date the rights run out, or null when they have no end date. */
export function rightsEndDate(respondedAt: Date | null, months: number | null): Date | null {
  if (!respondedAt || !months) return null;
  const end = new Date(respondedAt);
  end.setMonth(end.getMonth() + months);
  return end;
}

export function rightsTerms(brandName: string, months: number): string[] {
  return [
    `You're giving ${brandName} permission to use this post, including the photo or video, the caption, and your handle, on our website, social media, emails, and paid ads (including ads on Instagram and Facebook) ${rightsDurationPhrase(months)}.`,
    "You keep ownership of your content, and we'll credit you by your handle where we can.",
    "You confirm that you created this post and have permission from anyone who appears in it.",
    "If you change your mind, let us know and we'll stop using it in new ads.",
  ];
}

/** The message the brand sends the creator (DM or email) with the approval link. */
export function rightsRequestMessage(
  brandName: string,
  firstName: string | null,
  link: string
): string {
  const greeting = firstName ? `Hi ${firstName}!` : "Hi!";
  return `${greeting} Thank you so much for sharing ${brandName}. Would you be open to us featuring your post on our page and in our ads? You can approve it here:\n${link}`;
}
