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
  bounced: { label: "Email bounced", tone: "problem" },
  needs_answer: { label: "Needs your answer", tone: "waiting" },
  replied: { label: "You answered", tone: "neutral" },
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

/** One plain sentence per status, for the "What do these mean?" help. */
export const STAGE_HELP: Record<DisplayStage, string> = {
  needs_review: "Found by a search. Approve them to email them.",
  not_a_fit: "You decided they're not right for this campaign.",
  maybe_later: "Saved for another time.",
  ready: "Approved and ready for your first email.",
  emailed: "You emailed them and they haven't replied yet.",
  bounced: "Your email didn't reach them: the address doesn't work. Find another email for them.",
  needs_answer: "They replied and are waiting on you.",
  replied: "They replied and you've answered. Waiting on their next message.",
  said_yes: "They want the gift. Waiting for their address.",
  address_to_check: "They sent an address that needs a quick look.",
  address_in: "Their address is in. Next: the gift order.",
  order_made: "A Shopify order was made for them.",
  shipped: "Their gift is on the way.",
  delivered: "Their gift arrived.",
  posted: "They posted about you.",
  done: "Nothing left to do for this creator.",
  order_cancelled: "Their order was cancelled. Send them a new address link to try again.",
  said_no: "They said no, or asked to be removed. They won't be emailed again.",
  not_now: "Not right now. They can be emailed again later.",
};

/**
 * Display stages in the order the Overview chips show them. `always` chips
 * show even at 0 (the main path); the rest only when someone is there.
 */
export const DISPLAY_STAGE_ORDER: readonly { stage: DisplayStage; always: boolean }[] = [
  { stage: "needs_review", always: false },
  { stage: "ready", always: true },
  { stage: "emailed", always: true },
  { stage: "bounced", always: false },
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
  ctx: {
    campaignId: string;
    campaignCreatorId: string;
    threadId: string | null;
    hasWrittenEmail?: boolean;
    creatorId?: string;
  },
): StageNextStep {
  const base = `/campaigns/${ctx.campaignId}`;
  const conversation = ctx.threadId ? `/inbox/${ctx.threadId}` : "/inbox";
  switch (stage) {
    case "needs_review":
    case "maybe_later":
      return { label: "Review", href: `${base}/review` };
    case "ready":
      return ctx.hasWrittenEmail
        ? { label: "Send written email", href: `${base}/outreach?select=${ctx.campaignCreatorId}` }
        : { label: "Email them", href: `${base}/outreach?select=${ctx.campaignCreatorId}` };
    case "emailed":
    case "replied":
      return { label: "Waiting on them", href: null };
    case "bounced":
      return { label: "Find another email", href: ctx.creatorId ? `/creators/${ctx.creatorId}` : conversation };
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
    case "order_cancelled":
      return { label: "Send a new address link", href: conversation };
    case "done":
    case "said_no":
    case "not_now":
    case "not_a_fit":
      return null;
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
}
