/**
 * The one big button on a campaign's Overview. The first thing that needs
 * you wins, in this order. Counts come from lib/stats so they match Home.
 * Every stage in the "Needs you" chip has a step here, so the chip and the
 * button never disagree ("Needs you 1" next to "Nothing to do").
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
  /** Emails that bounced; the fix is a new address. */
  bounced?: number;
  /** When exactly one bounced, their creator page (where the new email goes). */
  bouncedCreatorId?: string | null;
  /** Address in, no gift order yet. */
  addressIn?: number;
  /** Orders cancelled, so they need a new address link. */
  ordersCancelled?: number;
  /** Saved as "Maybe later" in review. */
  maybeLater?: number;
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
      href: `${base}/outreach?written=1`,
    };
  }
  if (input.readyToEmail > 0) {
    return { label: `Email ${n(input.readyToEmail, "creator", "creators")}`, href: `${base}/outreach` };
  }
  if ((input.bounced ?? 0) > 0) {
    return {
      label: `Find ${n(input.bounced!, "new email", "new emails")}`,
      href: input.bouncedCreatorId ? `/creators/${input.bouncedCreatorId}` : `${base}?filter=bounced#creators`,
    };
  }
  if (input.addressesToCheck > 0) {
    return { label: `Check ${n(input.addressesToCheck, "address", "addresses")}`, href: "/inbox" };
  }
  if (input.draftOrders > 0) {
    return { label: `Finish ${n(input.draftOrders, "order", "orders")} in Shopify`, href: `${base}/orders` };
  }
  if ((input.addressIn ?? 0) > 0) {
    return { label: `Make ${n(input.addressIn!, "gift order", "gift orders")}`, href: `${base}/orders` };
  }
  if ((input.ordersCancelled ?? 0) > 0) {
    return {
      label: `Send ${n(input.ordersCancelled!, "new address link", "new address links")}`,
      href: `${base}?filter=order_cancelled#creators`,
    };
  }
  if (input.pendingReview > 0) {
    return { label: `Review ${n(input.pendingReview, "new creator", "new creators")}`, href: `${base}/review` };
  }
  if ((input.maybeLater ?? 0) > 0) {
    return { label: `Review ${n(input.maybeLater!, "saved creator", "saved creators")}`, href: `${base}/review` };
  }
  if (input.totalCreators === 0) {
    return { label: "Find creators", href: `${base}/discover` };
  }
  return null;
}
