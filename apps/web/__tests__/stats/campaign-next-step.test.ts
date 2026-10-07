import { describe, expect, it } from "vitest";
import { campaignNextStep, type NextStepInput } from "@/app/(platform)/campaigns/[campaignId]/_components/next-step";

const none: NextStepInput = {
  campaignId: "c1",
  needsAnswer: 0,
  writtenEmailsWaiting: 0,
  readyToEmail: 0,
  addressesToCheck: 0,
  draftOrders: 0,
  pendingReview: 0,
  totalCreators: 5,
};

describe("campaignNextStep", () => {
  it("puts replies first", () => {
    expect(campaignNextStep({ ...none, needsAnswer: 2, readyToEmail: 4, draftOrders: 1 })).toEqual({
      label: "Answer 2 replies",
      href: "/inbox?campaign=c1",
    });
  });

  it("prefers written emails over writing new ones", () => {
    expect(campaignNextStep({ ...none, writtenEmailsWaiting: 1, readyToEmail: 3 })?.label).toBe("Send 1 written email");
  });

  it("walks the rest of the order", () => {
    expect(campaignNextStep({ ...none, readyToEmail: 1 })).toEqual({ label: "Email 1 creator", href: "/campaigns/c1/outreach" });
    expect(campaignNextStep({ ...none, addressesToCheck: 3 })?.label).toBe("Check 3 addresses");
    expect(campaignNextStep({ ...none, draftOrders: 2 })).toEqual({
      label: "Finish 2 orders in Shopify",
      href: "/campaigns/c1/orders",
    });
    expect(campaignNextStep({ ...none, totalCreators: 0 })).toEqual({ label: "Find creators", href: "/campaigns/c1/discover" });
  });

  it("returns nothing when nothing needs you", () => {
    expect(campaignNextStep(none)).toBeNull();
  });
});
