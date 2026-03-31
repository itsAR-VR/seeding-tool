import { describe, expect, it } from "vitest";
import { extractContactPoints, isAgencyEmail } from "@/lib/identity/contact-extraction";

describe("contact extraction", () => {
  it("detects agency emails and boosts their confidence", () => {
    expect(isAgencyEmail("hello@talentmgmt.com")).toBe(true);

    const points = extractContactPoints({
      profile: {
        email: "hello@talentmgmt.com",
        websiteUrl: "https://talent.example.com",
        platform: "instagram",
      },
      sources: ["apify_search"],
    });

    const agencyEmail = points.find((point) => point.contactType === "agency_email");
    expect(agencyEmail).toMatchObject({
      contactValue: "hello@talentmgmt.com",
      source: "apify_search",
    });
    expect(agencyEmail?.confidence).toBeGreaterThan(0.5);
  });

  it("always exposes instagram DM as a fallback contact path", () => {
    const points = extractContactPoints({
      profile: {
        email: null,
        websiteUrl: null,
        platform: "instagram",
      },
      sources: [],
    });

    expect(points).toContainEqual(
      expect.objectContaining({
        contactType: "dm",
        contactValue: "instagram_dm",
      })
    );
  });
});
