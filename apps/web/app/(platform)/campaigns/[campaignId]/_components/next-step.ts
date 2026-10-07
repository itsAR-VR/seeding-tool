/**
 * The one big button on a campaign's Overview. The first thing that needs
 * you wins, in this order. Counts come from lib/stats so they match Home.
 */

export type NextStepInput = {
  campaignId: string;
  /** Creators whose newest message is from them with no decision yet. */
  needsAnswer: number;
  /** Creators with a written first email that hasn't been sent. */
  writtenEmailsWaiting: number;
  /** Approved and not emailed yet (includes the ones with written emails). */
  readyToEmail: number;
  addressesToCheck: number;
  draftOrders: number;
  pendingReview: number;
  totalCreators: number;
};

export type NextStep = { label: string; href: string } | null;

function n(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function campaignNextStep(input: NextStepInput): NextStep {
  const base = `/campaigns/${input.campaignId}`;
  if (input.needsAnswer > 0) {
    return {
      label: `Answer ${n(input.needsAnswer, "reply", "replies")}`,
      href: `/inbox?campaign=${encodeURIComponent(input.campaignId)}`,
    };
  }
  if (input.writtenEmailsWaiting > 0) {
    return {
      label: `Send ${n(input.writtenEmailsWaiting, "written email", "written emails")}`,
      href: `${base}/outreach`,
    };
  }
  if (input.readyToEmail > 0) {
    return { label: `Email ${n(input.readyToEmail, "creator", "creators")}`, href: `${base}/outreach` };
  }
  if (input.addressesToCheck > 0) {
    return { label: `Check ${n(input.addressesToCheck, "address", "addresses")}`, href: "/inbox" };
  }
  if (input.draftOrders > 0) {
    return { label: `Finish ${n(input.draftOrders, "order", "orders")} in Shopify`, href: `${base}/orders` };
  }
  if (input.pendingReview > 0) {
    return { label: `Review ${n(input.pendingReview, "new creator", "new creators")}`, href: `${base}/review` };
  }
  if (input.totalCreators === 0) {
    return { label: "Find creators", href: `${base}/discover` };
  }
  return null;
}
