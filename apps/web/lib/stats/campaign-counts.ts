/**
 * One set of definitions for every creator count the app shows.
 *
 * Two kinds of number, never mixed:
 *
 * - "Ever reached" (cumulative): how many creators got to a step at some
 *   point, even if they've moved past it since. Only the Results "So far"
 *   numbers use these, so "Emailed 14" means 14 people were emailed,
 *   including the ones who have since replied or posted.
 * - "Where they are now" (current): each creator counted once, at the step
 *   they're on today. The campaign Overview chips (via ./stage-display) and
 *   the Results breakdown use these.
 *
 * To-do counts ("needs your answer", "address to check", "no progress for 3
 * days", "emails waiting to send") are current by nature: they're what needs
 * you right now. Home, the campaign page, and System status all read them
 * from here so the numbers match everywhere.
 *
 * Every creator also has exactly one current stage (creatorStage below),
 * worked out from their stored status, their reply, their gift order, and
 * their posts. The status column, the Results breakdown, and the Order made /
 * Posted numbers all come from it, so they agree with the Orders and Posts tabs.
 *
 * This file has no database access so client components can use it. The
 * queries behind Home's "needs you" rows live in ./needs-you.ts.
 */

import type { AnalyticsResponse } from "@/lib/analytics/types";
// Circular with ./stage-display (which imports creatorStage from here). Labels
// below read STAGE_DISPLAY through getters, so they never run at load time.
import { STAGE_DISPLAY, type DisplayStage } from "./stage-display";

/** The status word for a stage, read when used (see the import note above). */
function stageLabel(stage: DisplayStage): string {
  return STAGE_DISPLAY[stage].label;
}

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
  /** Status of their ShopifyOrder; null means no order. Leave undefined when not loaded. */
  orderStatus?: string | null;
  /** Posts for this creator in this campaign, from the same list the Posts tab shows. Leave undefined when not loaded. */
  postCount?: number;
};

// ── Orders and posts ─────────────────────────────────────────

/** A cancelled order doesn't count as an order made, anywhere. */
export function isCountedOrder(status: string | null | undefined): boolean {
  return status != null && status !== "cancelled";
}

/** Orders made (not cancelled) and cancelled, for the Orders headings and Results. */
export function countOrders(orders: readonly { status: string }[]): { made: number; cancelled: number } {
  const made = orders.filter((o) => isCountedOrder(o.status)).length;
  return { made, cancelled: orders.length - made };
}

export function hasOrder(c: Pick<CountableCreator, "orderStatus">): boolean {
  return isCountedOrder(c.orderStatus);
}

export function hasPosted(c: Pick<CountableCreator, "postCount">): boolean {
  return (c.postCount ?? 0) > 0;
}

/** They said no: by reply, by opting out, or we marked it. */
export function saidNo(c: Pick<CountableCreator, "lifecycleStatus" | "replyDecision">): boolean {
  return c.lifecycleStatus === "opted_out" || c.replyDecision === "no";
}

/** Post counts per creator id, from the merged Posts-tab list. */
export function postCountsByCreator(posts: readonly { creatorId: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.creatorId) counts.set(post.creatorId, (counts.get(post.creatorId) ?? 0) + 1);
  }
  return counts;
}

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

/**
 * Address received: we've had their shipping address at some point (checked or not).
 * Someone whose order was cancelled shows as "Order cancelled" instead.
 */
export function everAddressIn(c: CountableCreator): boolean {
  if (c.orderStatus === "cancelled") return false;
  return ADDRESS_OR_LATER.has(c.lifecycleStatus) || hasOrder(c);
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

// ── One current stage per creator ────────────────────────────

export const CREATOR_STAGES = [
  "needs_review",
  "not_a_fit",
  "maybe_later",
  "ready",
  "emailed",
  "replied",
  "address_to_check",
  "address_in",
  "order_made",
  "shipped",
  "delivered",
  "posted",
  "done",
  "order_cancelled",
  "said_no",
  "not_now",
] as const;

export type CreatorStage = (typeof CREATOR_STAGES)[number];

// Words and tone for each stage live in ./stage-display (STAGE_DISPLAY).

/**
 * The one stage a creator is at today. Evidence beats the stored status:
 *
 * 1. Any post (same source as the Posts tab) means Posted (Done if closed out).
 * 2. Not approved yet: Needs review, Not a fit, or Maybe later.
 * 3. Said no (opted out, or replied no): Said no.
 * 4. A cancelled order: Order cancelled. Not Address received, not an order made.
 * 5. Any other order: Order made, Shipped, or Delivered (whichever is furthest
 *    between the order and the stored status).
 * 6. Otherwise the stored status: Not right now, Address to check, Address received,
 *    Replied, Waiting for reply, Not emailed yet. When orders and posts were loaded, a
 *    stored order or post step with no order or post on record shows as
 *    Address received, so it never counts as one. When they weren't loaded
 *    (undefined), the stored step is trusted.
 */
export function creatorStage(c: CountableCreator): CreatorStage {
  if (hasPosted(c)) return c.lifecycleStatus === "completed" ? "done" : "posted";

  if (c.reviewStatus === "pending") return "needs_review";
  if (c.reviewStatus === "declined") return "not_a_fit";
  if (c.reviewStatus === "deferred") return "maybe_later";

  if (saidNo(c)) return "said_no";
  if (c.orderStatus === "cancelled") return "order_cancelled";

  if (hasOrder(c)) {
    if (c.orderStatus === "delivered" || c.lifecycleStatus === "delivered") return "delivered";
    if (c.orderStatus === "shipped" || c.lifecycleStatus === "shipped") return "shipped";
    return "order_made";
  }

  if (c.lifecycleStatus === "completed") return "done";
  if (c.postCount === undefined && c.lifecycleStatus === "posted") return "posted";
  if (c.orderStatus === undefined) {
    if (c.lifecycleStatus === "delivered") return "delivered";
    if (c.lifecycleStatus === "shipped") return "shipped";
    if (c.lifecycleStatus === "order_created") return "order_made";
  }
  if (c.lifecycleStatus === "stalled" || c.replyDecision === "later") return "not_now";
  if (c.lifecycleStatus === "address_review" || addressToCheck(c)) return "address_to_check";
  if (ADDRESS_OR_LATER.has(c.lifecycleStatus)) return "address_in";
  if (everReplied(c)) return "replied";
  if (everEmailed(c)) return "emailed";
  return "ready";
}

/** How many creators are at each stage today. */
export function countStages(creators: readonly CountableCreator[]): Record<CreatorStage, number> {
  const counts = Object.fromEntries(CREATOR_STAGES.map((s) => [s, 0])) as Record<CreatorStage, number>;
  for (const c of creators) counts[creatorStage(c)] += 1;
  return counts;
}

// ── Campaign filters ─────────────────────────────────────────

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
  | "order_made"
  | "posted"
  | "order_cancelled"
  | "said_no"
  | "stuck";

/** Filters for the campaign creator list (?filter=). A count is always the size of its filtered list. Current-stage filters live in ./stage-display. */
export const CREATOR_FILTERS: Record<CreatorFilterKey, { readonly label: string; match: (c: CountableCreator) => boolean }> = {
  pending: { get label() { return stageLabel("needs_review"); }, match: (c) => c.reviewStatus === "pending" },
  approved: { label: "Approved", match: (c) => c.reviewStatus === "approved" },
  declined: { get label() { return stageLabel("not_a_fit"); }, match: (c) => c.reviewStatus === "declined" },
  to_email: { get label() { return stageLabel("ready"); }, match: readyToEmail },
  emailed: { label: "Emailed", match: everEmailed },
  replied: { get label() { return stageLabel("replied"); }, match: everReplied },
  needs_answer: { get label() { return stageLabel("needs_answer"); }, match: needsAnswer },
  address_in: { get label() { return stageLabel("address_in"); }, match: everAddressIn },
  address_review: { get label() { return stageLabel("address_to_check"); }, match: addressToCheck },
  order_made: { get label() { return stageLabel("order_made"); }, match: hasOrder },
  posted: { get label() { return stageLabel("posted"); }, match: hasPosted },
  order_cancelled: { get label() { return stageLabel("order_cancelled"); }, match: (c) => creatorStage(c) === "order_cancelled" },
  said_no: { get label() { return stageLabel("said_no"); }, match: (c) => creatorStage(c) === "said_no" },
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
export type StepCounts = {
  total: number;
  emailed: number;
  replied: number;
  addressIn: number;
  /** Creators with an order that wasn't cancelled. One order per creator, so this matches the Orders tab. */
  ordersMade: number;
  ordersCancelled: number;
  /** Creators with at least one post. */
  posted: number;
};

export function countStepsReached(creators: readonly CountableCreator[]): StepCounts {
  return {
    total: creators.length,
    emailed: creators.filter(everEmailed).length,
    replied: creators.filter(everReplied).length,
    addressIn: creators.filter(everAddressIn).length,
    ordersMade: creators.filter(hasOrder).length,
    ordersCancelled: creators.filter((c) => c.orderStatus === "cancelled").length,
    posted: creators.filter(hasPosted).length,
  };
}

/** Results data: the analytics payload plus the cumulative step counts and current stages. */
export type ResultsData = AnalyticsResponse & {
  readonly steps: StepCounts;
  readonly stages: Record<CreatorStage, number>;
  /** Posts on the Posts tab for these creators. */
  readonly postCount: number;
};

/** One row per stored lifecycle status: how many creators are on it today. */
export function lifecycleBreakdown(creators: readonly { lifecycleStatus: string }[]): Record<LifecycleStatus, number> {
  const breakdown = Object.fromEntries(LIFECYCLE_STATUSES.map((s) => [s, 0])) as Record<LifecycleStatus, number>;
  for (const c of creators) {
    if (c.lifecycleStatus in breakdown) breakdown[c.lifecycleStatus as LifecycleStatus] += 1;
  }
  return breakdown;
}

/**
 * Rows for "Where everyone is now". Each groups one or more stages under the
 * words of its `display` stage (STAGE_DISPLAY); the rest are listed underneath.
 */
export type CurrentStageRow = { readonly display: DisplayStage; readonly label: string; readonly stages: readonly CreatorStage[] };

function currentRow(display: DisplayStage, stages: readonly CreatorStage[]): CurrentStageRow {
  return {
    display,
    get label() {
      return stageLabel(display);
    },
    stages,
  };
}

export const CURRENT_STAGES: readonly CurrentStageRow[] = [
  currentRow("ready", ["needs_review", "ready"]),
  currentRow("emailed", ["emailed"]),
  currentRow("replied", ["replied"]),
  currentRow("address_in", ["address_to_check", "address_in"]),
  currentRow("order_made", ["order_made"]),
  currentRow("shipped", ["shipped"]),
  currentRow("delivered", ["delivered"]),
  currentRow("posted", ["posted"]),
  currentRow("done", ["done"]),
];

/** Stages off the main path, shown as a short note under the breakdown. */
export const OFF_PATH_STAGES = [
  "order_cancelled",
  "said_no",
  "not_now",
  "not_a_fit",
  "maybe_later",
] as const satisfies readonly CreatorStage[];

export function countCurrentStage(
  stages: Readonly<Partial<Record<CreatorStage, number>>>,
  keys: readonly CreatorStage[],
): number {
  return keys.reduce((sum, key) => sum + (stages[key] ?? 0), 0);
}
