import { describe, it, expect } from "vitest";
import { isClearOptOut } from "@/lib/inbox/opt-out";
import { guessFromIntent } from "@/lib/inbox/decision";

describe("isClearOptOut", () => {
  it.each([
    "Please take me off your list.",
    "unsubscribe",
    "STOP",
    "Stop emailing me.",
    "Not interested, remove me.",
    "Not interested in this, please remove me from your list",
    "Please don’t email me again.",
    "Do not contact me.",
    "Opt out please",
    "No more emails please, thanks.",
    "Unsubscribe\n\n--\nJane Doe\nCreator",
    "Remove me from this list.\n\nOn Mon, Oct 5, 2026 at 9:00 AM Kalm <hi@kalm.co> wrote:\n> Hi Jane, would you like a free gift?",
  ])("auto-handles a clear opt-out: %s", (body) => {
    expect(isClearOptOut(body)).toBe(true);
  });

  it.each([
    "",
    "No thanks!",
    "Not interested right now.",
    "How do I unsubscribe?",
    "Maybe later, remove me for now",
    "I'd love to try it, but please remove me from the newsletter",
    "Please don't remove me, I just can't do this month",
    "I didn't mean to unsubscribe",
    "Remove me and email my manager at mgr@agency.com instead",
    "Yes! Also stop emailing my old address",
    "Click the link below to unsubscribe from these notifications.",
    "Sounds good. Can you stop emailing my work address?",
  ])("leaves ambiguous replies for a person: %s", (body) => {
    expect(isClearOptOut(body)).toBe(false);
  });

  it("never auto-handles when the AI read it as something other than a no", () => {
    expect(isClearOptOut("Remove me", { intent: "question", confidence: 0.9 })).toBe(false);
    expect(isClearOptOut("Remove me", { intent: "positive", confidence: 0.6 })).toBe(false);
  });

  it("ignores a failed AI call (confidence 0) and falls back to the phrase check", () => {
    expect(isClearOptOut("Remove me", { intent: "other", confidence: 0 })).toBe(true);
  });

  it("needs a confident AI no for longer replies", () => {
    const long =
      "Hello there, thank you for thinking of me for this campaign. I have decided that I do not want " +
      "to receive emails like this one going forward so please remove me from your mailing list and " +
      "all of your future outreach. Thank you so much and take care.";
    expect(isClearOptOut(long)).toBe(false);
    expect(isClearOptOut(long, { intent: "negative", confidence: 0.6 })).toBe(false);
    expect(isClearOptOut(long, { intent: "negative", confidence: 0.95 })).toBe(true);
  });
});

describe("guessFromIntent for auto-handled opt-outs", () => {
  it("reads as a no", () => {
    expect(guessFromIntent("unsubscribe")).toBe("no");
  });
});
