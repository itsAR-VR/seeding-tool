import { describe, expect, it } from "vitest";
import {
  extractBrandProfileFromHtml,
  normalizeBrandWebsiteUrl,
} from "@/lib/brands/profile";

describe("brand profile extraction", () => {
  it("normalizes and validates website URLs", () => {
    expect(normalizeBrandWebsiteUrl("https://sleepkalm.com#about")).toBe(
      "https://sleepkalm.com/"
    );
    expect(() => normalizeBrandWebsiteUrl("ftp://sleepkalm.com")).toThrow(
      /http:\/\/ or https:\/\//i
    );
  });

  it("extracts metadata and visible text signals from homepage HTML", () => {
    const html = `
      <html>
        <head>
          <title>wellness in all forms – Kalm</title>
          <meta name="description" content="Vitamin-infused mouth tape for deeper sleep." />
          <meta property="og:site_name" content="Kalm" />
          <meta property="og:title" content="Sleep better with Kalm" />
          <meta property="og:description" content="Soft, breathable mouth tape that stays put all night." />
          <meta property="og:image" content="/images/og.png" />
          <meta name="twitter:title" content="Kalm mouth tape" />
          <meta name="twitter:description" content="Unlock deeper and more energized sleep." />
        </head>
        <body>
          <h1>new vitamin infused mouth tape</h1>
          <h2>unlock deeper and more energized sleep</h2>
          <p>Soft, breathable, and stays put all night.</p>
          <p>Comfort-first, skin-friendly support with easy-peel removal.</p>
        </body>
      </html>
    `;

    const profile = extractBrandProfileFromHtml(html, "https://sleepkalm.com");

    expect(profile.domain).toBe("sleepkalm.com");
    expect(profile.title).toBe("wellness in all forms – Kalm");
    expect(profile.description).toBe(
      "Vitamin-infused mouth tape for deeper sleep."
    );
    expect(profile.ogImage).toBe("https://sleepkalm.com/images/og.png");
    expect(profile.heroHeadings).toContain("new vitamin infused mouth tape");
    expect(profile.textSignals.join(" ")).toMatch(/deeper and more energized sleep/i);
  });
});
