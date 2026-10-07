/**
 * How a creator's current stage looks everywhere it shows: the status pill
 * words and tone, the Overview chips, and the "Next step" column.
 *
 * The stage itself comes from creatorStage (./campaign-counts). Display adds
 * one split the stage doesn't make: someone who replied either needs an
 * answer from you, said yes and owes an address, or is waiting on their next
 * message. Each creator lands on exactly one display stage, so chip counts
 * always add up to the total.
 *
 * No database access, so client components can use it.
 */

import type { StatusTone } from "@/components/status-pill";
import { creatorStage, needsAnswer, type CountableCreator, type CreatorStage } from "./campaign-counts";

export type DisplayStage = CreatorStage | "needs_answer" | "said_yes";

export type StageDisplay = { label: string; tone: StatusTone };

/** One label and one tone per stage. Use these words wherever a creator's status shows. */
export const STAGE_DISPLAY: Record<DisplayStage, StageDisplay> = {
  needs_review: { label: "Needs review", tone: "waiting" },
  not_a_fit: { label: "Not a fit", tone: "neutral" },
  maybe_later: { label: "Maybe later", tone: "neutral" },
  ready: { label: "Not emailed yet", tone: "neutral" },
  emailed: { label: "Waiting for reply", tone: "neutral" },
  needs_answer: { label: "Needs an answer", tone: "waiting" },
  replied: { label: "Replied", tone: "waiting" },
  said_yes: { label: "Said yes", tone: "good" },
  address_to_check: { label: "Address to check", tone: "waiting" },
  address_in: { label: "Address received", tone: "good" },
  order_made: { label: "Order made", tone: "good" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  posted: { label: "Posted", tone: "good" },
  done: { label: "Done", tone: "good" },
  order_cancelled: { label: "Order cancelled", tone: "neutral" },
  said_no: { label: "Said no", tone: "neutral" },
  not_now: { label: "Not right now", tone: "neutral" },
};

/**
 * Display stages in the order the Overview chips show them. `always` chips
 * show even at 0 (the main path); the rest only when someone is there.
 */
export const DISPLAY_STAGE_ORDER: readonly { stage: DisplayStage; always: boolean }[] = [
  { stage: "needs_review", always: false },
  { stage: "ready", always: true },
  { stage: "emailed", always: true },
  { stage: "needs_answer", always: true },
  { stage: "replied", always: false },
  { stage: "said_yes", always: false },
  { stage: "address_to_check", always: false },
  { stage: "address_in", always: true },
  { stage: "order_made", always: true },
  { stage: "shipped", always: false },
  { stage: "delivered", always: false },
  { stage: "posted", always: true },
  { stage: "done", always: false },
  { stage: "not_now", always: false },
  { stage: "said_no", always: false },
  { stage: "order_cancelled", always: false },
  { stage: "not_a_fit", always: false },
  { stage: "maybe_later", always: false },
];

export function isDisplayStage(value: string | null | undefined): value is DisplayStage {
  return value != null && Object.prototype.hasOwnProperty.call(STAGE_DISPLAY, value);
}

/** Refine a creatorStage with the reply split. */
export function displayStageFor(
  stage: CreatorStage,
  c: Pick<CountableCreator, "replyDecision" | "latestMessageDirection">,
): DisplayStage {
  if (stage === "emailed" || stage === "replied") {
    if (needsAnswer(c)) return "needs_answer";
    if (stage === "replied" && c.replyDecision === "yes") return "said_yes";
  }
  return stage;
}

/** The one display stage a creator is at today. */
export function displayStage(c: CountableCreator): DisplayStage {
  return displayStageFor(creatorStage(c), c);
}

/** How many creators are at each display stage. Sums to the number of creators. */
export function countDisplayStages(stages: readonly DisplayStage[]): Record<DisplayStage, number> {
  const counts = Object.fromEntries(Object.keys(STAGE_DISPLAY).map((s) => [s, 0])) as Record<DisplayStage, number>;
  for (const stage of stages) counts[stage] += 1;
  return counts;
}

export type StageNextStep = { label: string; href: string | null } | null;

/**
 * What to do next for one creator, by stage. A null href means it's on them
 * (shown as quiet text); null means there's nothing to do.
 */
export function stageNextStep(
  stage: DisplayStage,
  ctx: { campaignId: string; campaignCreatorId: string; threadId: string | null },
): StageNextStep {
  const base = `/campaigns/${ctx.campaignId}`;
  const conversation = ctx.threadId ? `/inbox/${ctx.threadId}` : "/inbox";
  switch (stage) {
    case "needs_review":
      return { label: "Review", href: `${base}/review` };
    case "ready":
      return { label: "Email them", href: `${base}/outreach?select=${ctx.campaignCreatorId}` };
    case "emailed":
    case "replied":
      return { label: "Waiting on them", href: null };
    case "needs_answer":
      return { label: "Answer them", href: conversation };
    case "said_yes":
      return { label: "Waiting for their address", href: null };
    case "address_to_check":
      return { label: "Check address", href: conversation };
    case "address_in":
      return { label: "Finish order", href: `${base}/orders` };
    case "order_made":
      return { label: "Ship in Shopify", href: `${base}/orders` };
    case "shipped":
    case "delivered":
      return { label: "Waiting for their post", href: null };
    case "posted":
      return { label: "Request rights", href: "/content" };
    case "done":
    case "order_cancelled":
    case "said_no":
    case "not_now":
    case "not_a_fit":
    case "maybe_later":
      return null;
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
}
