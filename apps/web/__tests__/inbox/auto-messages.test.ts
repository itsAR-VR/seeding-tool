import { describe, expect, it } from "vitest";
import { bouncedAddresses, isAutoReply, isBounce } from "@/lib/inbox/auto-messages";

const MINUTE = 60 * 1000;

describe("auto-replies", () => {
  it("spots a canned responder that came back the same minute", () => {
    const body =
      "Thank you for your email and your interest in Strong Finish Run Coaching & Sports Nutrition! I am connected to email most of the time. If you're looking to get more info on how I can help you, please fill out the Athlete Assessment Form, so I can review before getting back to you.";
    expect(isAutoReply({ from: "Kristen <k@example.com>", body }, { sinceOurEmailMs: 30 * 1000 })).toBe(true);
  });

  it("never hides a real, quick, thankful yes", () => {
    const body = "Thank you for reaching out! I'd love to try it, sending my address now.";
    expect(isAutoReply({ from: "a@example.com", body }, { sinceOurEmailMs: MINUTE })).toBe(false);
  });

  it("leaves a canned-sounding thank-you alone when it came hours later", () => {
    const body = "Thank you for your email! I'll get back to you once I check with my manager.";
    expect(isAutoReply({ from: "a@example.com", body }, { sinceOurEmailMs: 5 * 60 * MINUTE })).toBe(false);
  });

  it("trusts the Auto-Submitted header, and ignores 'no'", () => {
    expect(isAutoReply({ from: "a@example.com", body: "Hi", headers: { autoSubmitted: "auto-replied" } })).toBe(true);
    expect(isAutoReply({ from: "a@example.com", body: "Hi", headers: { autoSubmitted: "no" } })).toBe(false);
  });

  it("knows out-of-office subjects and wording", () => {
    expect(isAutoReply({ from: "a@example.com", subject: "Automatic reply: better sleep, on us", body: "" })).toBe(true);
    expect(
      isAutoReply(
        { from: "a@example.com", subject: "Re: better sleep", body: "I'm currently out of the office until Monday." },
        { sinceOurEmailMs: 20 * 1000 },
      ),
    ).toBe(true);
  });

  it("keeps a real person's out-of-office yes that came later", () => {
    const body = "I'm out of the office this week, but yes I'd love one!";
    expect(isAutoReply({ from: "a@example.com", body }, { sinceOurEmailMs: 3 * 60 * MINUTE })).toBe(false);
  });

  it("doesn't call an ordinary reply automatic", () => {
    expect(isAutoReply({ from: "a@example.com", subject: "Re: better sleep, on us", body: "Yes please! Do you ship to Canada?" })).toBe(false);
  });
});

describe("bounces", () => {
  const gmailBounce = {
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Failure)",
    body: "Address not found\n\nYour message wasn't delivered to info@kimschaper.com because the address couldn't be found, or is unable to receive mail.",
  };

  it("spots a mail server failure and finds the address that failed", () => {
    expect(isBounce(gmailBounce)).toBe(true);
    expect(bouncedAddresses(gmailBounce)).toEqual(["info@kimschaper.com"]);
  });

  it("prefers the X-Failed-Recipients header", () => {
    const mail = { ...gmailBounce, headers: { failedRecipients: "Info@KimSchaper.com" } };
    expect(bouncedAddresses(mail)[0]).toBe("info@kimschaper.com");
  });

  it("doesn't treat a creator who mentions an address as a bounce", () => {
    expect(isBounce({ from: "kim@example.com", subject: "Re: better sleep", body: "My address is 12 Main St" })).toBe(false);
  });
});

describe("email text", () => {
  it("turns HTML codes back into what they typed", async () => {
    const { decodeEntities } = await import("@/lib/format/html-entities");
    expect(decodeEntities("Run Coaching &amp; Sports Nutrition &#39;26 &lt;3")).toBe("Run Coaching & Sports Nutrition '26 <3");
    expect(decodeEntities("AT&T stays")).toBe("AT&T stays");
  });
});
