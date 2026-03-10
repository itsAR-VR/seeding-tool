import { describe, expect, it } from "vitest";
import { suggestCategorySelectionFromBrandProfile } from "@/lib/categories/suggestions";
import { extractBrandProfileFromHtml } from "@/lib/brands/profile";

describe("brand category suggestions", () => {
  it("suggests supported discovery keywords from scraped website content", () => {
    const html = `
      <html>
        <head>
          <title>SleepKalm wellness support</title>
          <meta name="description" content="Vitamin-infused mouth tape for deeper sleep and recovery." />
        </head>
        <body>
          <h1>Deeper sleep for wellness routines</h1>
          <p>Comfort-first mouth tape with vitamin support and skin-friendly removal.</p>
        </body>
      </html>
    `;

    const profile = extractBrandProfileFromHtml(html, "https://sleepkalm.com");
    const result = suggestCategorySelectionFromBrandProfile(profile);

    expect(result.selection.collabstr).toContain("Health & Wellness");
    expect(result.selection.collabstr).toContain("Supplements");
    expect(result.selection.collabstr).toContain("Skincare");
    expect(result.matchedLabels).toContain("Health & Wellness");
  });

  it("returns empty suggestions when no profile exists", () => {
    const result = suggestCategorySelectionFromBrandProfile(null);

    expect(result.selection).toEqual({ apify: [], collabstr: [] });
    expect(result.matchedLabels).toEqual([]);
  });

  it("uses edited Business DNA keywords and audience fields for suggestions", () => {
    const profile = extractBrandProfileFromHtml(
      "<html><body><main><h1>Plain brand shell</h1></main></body></html>",
      "https://example.com"
    );

    profile.brandSummary = "A premium outdoor camping brand for adventure-led families.";
    profile.targetAudience = "Families planning outdoor camping trips";
    profile.keywords = ["camping gear", "outdoor adventure"];

    const result = suggestCategorySelectionFromBrandProfile(profile);

    expect(result.selection.collabstr).toContain("Outdoor & Adventure");
    expect(result.matchedLabels).toContain("Outdoor & Adventure");
  });
});
