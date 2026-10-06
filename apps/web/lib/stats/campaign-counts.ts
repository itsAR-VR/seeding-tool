/**
 * One set of definitions for every creator count the app shows.
 *
 * Two kinds of number, never mixed:
 *
 * - "Ever reached" (cumulative): how many creators got to a step at some
 *   point, even if they've moved past it since. Summary numbers and the
 *   campaign filter chips use these, so "Emailed 14" means 14 people were
 *   emailed, including the ones who have since replied or posted.
 * - "Where they are now" (current): each creator counted once, at the step
 *   they're on today. Only the Results breakdown uses these, and it says so.
 *
 * To-do counts ("needs an answer", "address to check", "no progress for 3
 * days", "emails waiting to send") are current by nature: they're what needs
 * you right now. Home, the campaign page, and System status all read them
 * from here so the numbers match everywhere.
 *
 * This file has no database access so client components can use it. The
 * queries behind Home's "needs you" rows live in ./needs-you.ts.
 */

import type { AnalyticsResponse } from "@/lib/analytics/types";

// ── Lifecycle steps ──────────────────────────────────────────

/** Every stored lifecycle status, in the order a creator moves through them. */
export const LIFECYCLE_STATUSES = [
  "ready",
  "outreach_sent",
  "replied",
  "address_review",
  "address_confirmed",
  "order_created",
  "shipped",
  "delivered",
  "posted",
  "completed",
  "opted_out",
  "stalled",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** The main path, in order. opted_out and stalled are exits, not steps. */
const PATH: readonly string[] = LIFECYCLE_STATUSES.slice(0, 10);

/** Statuses at or after `step` on the main path. */
function atOrAfter(step: LifecycleStatus): ReadonlySet<string> {
  return new Set(PATH.slice(PATH.indexOf(step)));
}

const EMAILED_OR_LATER = atOrAfter("outreach_sent");
const REPLIED_OR_LATER = atOrAfter("replied");
const ADDRESS_OR_LATER = atOrAfter("address_review");

// ── Per-creator predicates ───────────────────────────────────

export type AddressSnapshot = { isActive: boolean; confirmedAt: Date | null };

/** The fields a creator row needs for every count. Optional fields default to "no evidence". */
export type CountableCreator = {
  reviewStatus: string;
  lifecycleStatus: string;
  outreachCount?: number | null;
  lastOutreachAt?: Date | null;
  lastReplyAt?: Date | null;
  replyDecision?: string | null;
  /** Direction of the newest message in their conversation, if there is one. */
  latestMessageDirection?: string | null;
  shippingSnapshots?: readonly AddressSnapshot[];
  /** Set by the caller from findStuckCreators, which needs the database. */
  stuck?: boolean;
};

/** Ever emailed: past "ready", or we have a record of sending them something. */
export function everEmailed(c: CountableCreator): boolean {
  return (
    EMAILED_OR_LATER.has(c.lifecycleStatus) ||
    (c.outreachCount ?? 0) > 0 ||
    c.lastOutreachAt != null
  );
}

/** Ever replied: reached "replied" or later, or we have a reply on record (this catches people who replied no). */
export function everReplied(c: CountableCreator): boolean {
  return REPLIED_OR_LATER.has(c.lifecycleStatus) || c.lastReplyAt != null || c.replyDecision != null;
}

/** Address in: we've had their shipping address at some point (checked or not). */
export function everAddressIn(c: CountableCreator): boolean {
  return ADDRESS_OR_LATER.has(c.lifecycleStatus);
}

/** Approved and not emailed yet. */
export function readyToEmail(c: CountableCreator): boolean {
  return c.reviewStatus === "approved" && c.lifecycleStatus === "ready";
}

/** Their newest message is from them and nobody has decided yes, no, or later. */
export function needsAnswer(c: Pick<CountableCreator, "replyDecision" | "latestMessageDirection">): boolean {
  return c.replyDecision == null && c.latestMessageDirection === "inbound";
}

/**
 * An address came in that nobody has checked, and no address has been
 * confirmed since (a later claim-form submission confirms itself).
 */
export function addressToCheck(c: Pick<CountableCreator, "shippingSnapshots">): boolean {
  const snapshots = c.shippingSnapshots ?? [];
  return (
    snapshots.some((s) => !s.isActive && s.confirmedAt == null) &&
    !snapshots.some((s) => s.confirmedAt != null)
  );
}

/** Same rule as addressToCheck, as a Prisma filter on CampaignCreator. */
export const ADDRESS_TO_CHECK_WHERE = {
  AND: [
    { shippingSnapshots: { some: { isActive: false, confirmedAt: null } } },
    { shippingSnapshots: { none: { confirmedAt: { not: null } } } },
  ],
};

// ── Campaign chips ───────────────────────────────────────────

export const STUCK_AFTER_DAYS = 3;

export type CreatorFilterKey =
  | "pending"
  | "approved"
  | "declined"
  | "to_email"
  | "emailed"
  | "replied"
  | "needs_answer"
  | "address_in"
  | "address_review"
  | "stuck";

/** Filters for the campaign creator list. A chip's number is always the size of its filtered list. */
export const CREATOR_FILTERS: Record<CreatorFilterKey, { label: string; match: (c: CountableCreator) => boolean }> = {
  pending: { label: "Needs review", match: (c) => c.reviewStatus === "pending" },
  approved: { label: "Approved", match: (c) => c.reviewStatus === "approved" },
  declined: { label: "Not a fit", match: (c) => c.reviewStatus === "declined" },
  to_email: { label: "Ready to email", match: readyToEmail },
  emailed: { label: "Emailed", match: everEmailed },
  replied: { label: "Replied", match: everReplied },
  needs_answer: { label: "Needs an answer", match: needsAnswer },
  address_in: { label: "Address in", match: everAddressIn },
  address_review: { label: "Address to check", match: addressToCheck },
  stuck: { label: `No progress for ${STUCK_AFTER_DAYS} days`, match: (c) => c.stuck === true },
};

export function isCreatorFilterKey(value: string | undefined): value is CreatorFilterKey {
  return value != null && Object.prototype.hasOwnProperty.call(CREATOR_FILTERS, value);
}

export type CampaignCounts = Record<CreatorFilterKey, number> & { total: number };

/** Every chip count for a list of creators, from the same predicates the filters use. */
export function countCampaignCreators(creators: readonly CountableCreator[]): CampaignCounts {
  const counts = { total: creators.length } as CampaignCounts;
  for (const key of Object.keys(CREATOR_FILTERS) as CreatorFilterKey[]) {
    counts[key] = creators.filter(CREATOR_FILTERS[key].match).length;
  }
  return counts;
}

// ── Results: ever reached, and where everyone is now ─────────

/** Cumulative step counts shown in the Results summary line. */
export type StepCounts = { total: number; emailed: number; replied: number; addressIn: number };

export function countStepsReached(creators: readonly CountableCreator[]): StepCounts {
  return {
    total: creators.length,
    emailed: creators.filter(everEmailed).length,
    replied: creators.filter(everReplied).length,
    addressIn: creators.filter(everAddressIn).length,
  };
}

/** Results data: the analytics payload plus the cumulative step counts. */
export type ResultsData = AnalyticsResponse & { readonly steps: StepCounts };

/** One row per stored lifecycle status: how many creators are on it today. */
export function lifecycleBreakdown(creators: readonly { lifecycleStatus: string }[]): Record<LifecycleStatus, number> {
  const breakdown = Object.fromEntries(LIFECYCLE_STATUSES.map((s) => [s, 0])) as Record<LifecycleStatus, number>;
  for (const c of creators) {
    if (c.lifecycleStatus in breakdown) breakdown[c.lifecycleStatus as LifecycleStatus] += 1;
  }
  return breakdown;
}

/** Plain stages for "Where everyone is now". Each groups one or more stored statuses. */
export const CURRENT_STAGES: readonly { label: string; keys: readonly LifecycleStatus[] }[] = [
  { label: "Not emailed yet", keys: ["ready"] },
  { label: "Emailed, no reply yet", keys: ["outreach_sent"] },
  { label: "Replied", keys: ["replied"] },
  { label: "Address in", keys: ["address_review", "address_confirmed"] },
  { label: "Order made", keys: ["order_created"] },
  { label: "Shipped", keys: ["shipped"] },
  { label: "Delivered", keys: ["delivered"] },
  { label: "Posted", keys: ["posted"] },
  { label: "Done", keys: ["completed"] },
];

export function countCurrentStage(lifecycle: Readonly<Record<string, number>>, keys: readonly string[]): number {
  return keys.reduce((sum, key) => sum + (lifecycle[key] ?? 0), 0);
}
