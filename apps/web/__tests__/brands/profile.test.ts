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
          <meta name="twitter:image" content="/images/twitter.png" />
        </head>
        <body>
          <main>
            <h1>new vitamin infused mouth tape</h1>
            <h2>unlock deeper and more energized sleep</h2>
            <img src="/images/hero-one.jpg" width="640" height="640" />
            <img src="/images/hero-two.jpg" width="640" height="640" />
            <p>Soft, breathable, and stays put all night.</p>
            <p>Comfort-first, skin-friendly support with easy-peel removal.</p>
          </main>
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
    expect(profile.twitterImage).toBe("https://sleepkalm.com/images/twitter.png");
    expect(profile.heroHeadings).toContain("new vitamin infused mouth tape");
    expect(profile.heroImageCandidates).toEqual([
      "https://sleepkalm.com/images/hero-one.jpg",
      "https://sleepkalm.com/images/hero-two.jpg",
    ]);
    expect(profile.textSignals.join(" ")).toMatch(/deeper and more energized sleep/i);
  });

  it("filters junk hero images and caps the candidate list", () => {
    const html = `
      <html>
        <body>
          <main>
            <img src="/images/hero-1.jpg" width="300" height="300" />
            <img src="/images/hero-2.jpg" width="320" height="320" />
            <img src="/images/hero-3.jpg" width="340" height="340" />
            <img src="/images/hero-4.jpg" width="360" height="360" />
            <img src="/images/hero-5.jpg" width="380" height="380" />
            <img src="/images/hero-6.jpg" width="400" height="400" />
            <img src="/images/icon.svg" width="300" height="300" />
            <img src="https://tracker.example/pixel.gif" width="1" height="1" />
            <img src="/images/tiny.jpg" width="80" height="80" />
          </main>
        </body>
      </html>
    `;

    const profile = extractBrandProfileFromHtml(html, "https://sleepkalm.com");

    expect(profile.heroImageCandidates).toEqual([
      "https://sleepkalm.com/images/hero-1.jpg",
      "https://sleepkalm.com/images/hero-2.jpg",
      "https://sleepkalm.com/images/hero-3.jpg",
      "https://sleepkalm.com/images/hero-4.jpg",
      "https://sleepkalm.com/images/hero-5.jpg",
    ]);
  });
});
