/**
 * The four Overview chips. Each display stage sits in exactly one group, so
 * the chips add up to All. Inside a group the table still shows each
 * creator's exact status pill (lib/stats/stage-display).
 */

import type { CreatorFilterKey } from "@/lib/stats/campaign-counts";
import { isDisplayStage, type DisplayStage } from "@/lib/stats/stage-display";

export type StageGroupKey = "needs_you" | "waiting" | "done" | "said_no";

export type StageGroup = {
  key: StageGroupKey;
  label: string;
  stages: readonly DisplayStage[];
  /** Show the chip even when nobody is in it. */
  always: boolean;
};

export const STAGE_GROUPS: readonly StageGroup[] = [
  // Every stage whose next step is yours: review (or review again), email, answer, check, order, ship, re-send the link.
  {
    key: "needs_you",
    label: "Needs you",
    stages: [
      "needs_review",
      "maybe_later",
      "ready",
      "bounced",
      "needs_answer",
      "address_to_check",
      "address_in",
      "order_made",
      "order_cancelled",
    ],
    always: true,
  },
  // The next step is theirs: a reply, an address, the parcel arriving, a post.
  { key: "waiting", label: "Waiting", stages: ["emailed", "replied", "said_yes", "not_now", "shipped", "delivered"], always: true },
  { key: "done", label: "Done", stages: ["posted", "done"], always: true },
  // Named after exactly the two statuses inside it, so the chip and the rows agree.
  { key: "said_no", label: "Said no or not a fit", stages: ["said_no", "not_a_fit"], always: false },
];

const GROUP_BY_KEY = new Map(STAGE_GROUPS.map((g) => [g.key, g]));

export function stageGroupFor(stage: DisplayStage): StageGroup {
  const group = STAGE_GROUPS.find((g) => g.stages.includes(stage));
  if (!group) throw new Error(`Stage ${stage} has no Overview group`);
  return group;
}

/** Older ?filter= keys (Home, bookmarks) that now open a group. */
const LEGACY_FILTER_GROUP: Partial<Record<CreatorFilterKey, StageGroupKey>> = {
  pending: "needs_you",
  needs_answer: "needs_you",
  address_review: "needs_you",
  to_email: "needs_you",
  emailed: "waiting",
  replied: "waiting",
  address_in: "needs_you",
  order_made: "needs_you",
  posted: "done",
  declined: "said_no",
  order_cancelled: "needs_you",
  said_no: "said_no",
};

/**
 * Which group a ?filter= value opens: a group key, a display stage, or an
 * older filter key. Null when it isn't one (e.g. "stuck", which stays its
 * own small link).
 */
export function groupForFilter(filter: string | null | undefined): StageGroup | null {
  if (filter == null) return null;
  const direct = GROUP_BY_KEY.get(filter as StageGroupKey);
  if (direct) return direct;
  if (isDisplayStage(filter)) return stageGroupFor(filter);
  const legacy = LEGACY_FILTER_GROUP[filter as CreatorFilterKey];
  return legacy ? (GROUP_BY_KEY.get(legacy) ?? null) : null;
}

/** How many creators are in each group. Sums to the number of creators. */
export function countStageGroups(stages: readonly DisplayStage[]): Record<StageGroupKey, number> {
  const counts: Record<StageGroupKey, number> = { needs_you: 0, waiting: 0, done: 0, said_no: 0 };
  for (const stage of stages) counts[stageGroupFor(stage).key] += 1;
  return counts;
}
