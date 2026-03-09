#!/usr/bin/env npx tsx
/**
 * Collabstr Influencer Scraper
 *
 * Scrapes the Collabstr influencer directory using Playwright browser.
 * Extracts: name, niche, location, IG handle, TikTok handle, website, followers, bio, image.
 * Data source: JSON-LD structured data embedded in each profile page (no login required).
 *
 * Usage:
 *   npx tsx scripts/scrape-collabstr.ts [--start-page N] [--max-pages N] [--output path]
 *
 * Checkpointing: Writes state to scripts/.collabstr-checkpoint.json for resume.
 * Output: JSONL file at scripts/collabstr-influencers.jsonl
 */

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = "https://collabstr.com";
const LISTING_URL = `${BASE_URL}/influencers`;
const DELAY_BETWEEN_PROFILES_MS = 2000; // Be respectful
const DELAY_BETWEEN_PAGES_MS = 3000;
const CHECKPOINT_EVERY = 10; // Save state every N profiles
const MAX_RETRIES = 3;

// ── Types ───────────────────────────────────────────────────────────────────
interface ScrapedInfluencer {
  collabstrSlug: string;
  collabstrUrl: string;
  name: string | null;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  website: string | null;
  followerCount: number | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string;
}

interface CheckpointState {
  lastPage: number;
  lastSlugIndex: number;
  totalScraped: number;
  scrapedSlugs: Set<string>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseArgs(): {
  startPage: number;
  maxPages: number;
  output: string;
} {
  const args = process.argv.slice(2);
  let startPage = 1;
  let maxPages = 9999;
  let output = path.join(__dirname, "collabstr-influencers.jsonl");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-page" && args[i + 1]) {
      startPage = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--max-pages" && args[i + 1]) {
      maxPages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  return { startPage, maxPages, output };
}

function loadCheckpoint(): CheckpointState | null {
  const cpPath = path.join(__dirname, ".collabstr-checkpoint.json");
  if (!fs.existsSync(cpPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(cpPath, "utf-8"));
    return {
      ...data,
      scrapedSlugs: new Set(data.scrapedSlugs || []),
    };
  } catch {
    return null;
  }
}

function saveCheckpoint(state: CheckpointState): void {
  const cpPath = path.join(__dirname, ".collabstr-checkpoint.json");
  fs.writeFileSync(
    cpPath,
    JSON.stringify(
      {
        ...state,
        scrapedSlugs: Array.from(state.scrapedSlugs),
      },
      null,
      2
    )
  );
}

function appendToOutput(output: string, influencer: ScrapedInfluencer): void {
  fs.appendFileSync(output, JSON.stringify(influencer) + "\n");
}

function parseFollowerCount(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/([\d.]+)\s*(k|m|K|M)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function extractHandleFromUrl(
  url: string,
  platform: "instagram" | "tiktok"
): string | null {
  try {
    const u = new URL(url);
    const pathPart = u.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (platform === "tiktok") {
      return pathPart.replace(/^@/, "");
    }
    // Skip non-user paths
    if (
      ["p", "explore", "reel", "stories", "accounts", "i18n"].includes(
        pathPart.split("/")[0]
      )
    ) {
      return null;
    }
    return pathPart || null;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Listing page scraper ────────────────────────────────────────────────────
async function scrapeListingPage(
  page: Page,
  pageNum: number
): Promise<string[]> {
  const url = pageNum === 1 ? LISTING_URL : `${LISTING_URL}?pg=${pageNum}`;
  console.log(`[listing] Navigating to page ${pageNum}: ${url}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await sleep(1000);

  // Extract all profile links from the page
  const slugs = await page.evaluate(() => {
    const links = document.querySelectorAll("a[href]");
    const result: string[] = [];
    const seen = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      // Profile links are like /username (no slashes, not system paths)
      if (
        href.startsWith("/") &&
        !href.includes("?") &&
        href.split("/").length === 2
      ) {
        const slug = href.slice(1);
        // Exclude known system paths
        const systemPaths = [
          "login",
          "brand",
          "creator",
          "pricing",
          "blog",
          "faq",
          "support",
          "privacy",
          "terms",
          "sitemap",
          "influencers",
          "find-influencers",
          "top-influencers",
          "search-influencers",
          "influencer-shoutouts",
          "resource-hub",
          "influencer-price-calculator",
          "instagram-fake-follower-checker",
          "tiktok-fake-follower-checker",
          "instagram-engagement-rate-calculator",
          "tiktok-engagement-rate-calculator",
          "influencer-campaign-brief-template",
          "influencer-contract-template",
          "influencer-analytics",
          "instagram-reels-downloader",
          "tiktok-video-downloader",
          "ultimate-guide-to-tiktok-for-brands",
          "2026-influencer-marketing-report",
        ];
        if (
          slug &&
          !systemPaths.includes(slug) &&
          !slug.startsWith("top-influencers/") &&
          !seen.has(slug)
        ) {
          seen.add(slug);
          result.push(slug);
        }
      }
    });
    return result;
  });

  console.log(`[listing] Found ${slugs.length} profiles on page ${pageNum}`);
  return slugs;
}

// ── Profile page scraper ────────────────────────────────────────────────────
async function scrapeProfilePage(
  page: Page,
  slug: string
): Promise<ScrapedInfluencer | null> {
  const url = `${BASE_URL}/${slug}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
      await sleep(500);

      const data = await page.evaluate(() => {
        // Extract JSON-LD
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        let sameAs: string[] = [];
        let name: string | null = null;
        let description: string | null = null;
        let imageUrl: string | null = null;
        let location: string | null = null;
        let lowPrice: string | null = null;
        let ratingValue: number | null = null;
        let reviewCount: number | null = null;

        jsonLdScripts.forEach((script) => {
          try {
            const parsed = JSON.parse(script.textContent || "");
            const items = Array.isArray(parsed) ? parsed : [parsed];

            for (const item of items) {
              if (item.provider?.sameAs) {
                sameAs = sameAs.concat(item.provider.sameAs);
                if (item.provider.name) name = item.provider.name;
                if (item.provider.image) imageUrl = item.provider.image;
              }
              if (item.brand?.name && !name) name = item.brand.name;
              if (item.image?.[0] && !imageUrl) imageUrl = item.image[0];
              if (item.description) description = item.description;
              if (item.areaServed?.name) location = item.areaServed.name;
              if (item.offers?.lowPrice) lowPrice = item.offers.lowPrice;
              if (item.aggregateRating) {
                ratingValue = item.aggregateRating.ratingValue;
                reviewCount = item.aggregateRating.reviewCount;
              }
            }
          } catch {}
        });

        // Extract niche from h1
        const h1s = document.querySelectorAll("h1");
        let niche: string | null = null;
        h1s.forEach((h1) => {
          const text = h1.textContent?.trim() || "";
          // The first h1 is usually the niche (e.g., "Lifestyle content creator")
          // The second h1 is the name
          if (text && text !== name && !niche) {
            niche = text;
          }
        });

        // Extract follower text
        const bodyText = document.body.textContent || "";
        const followerMatch = bodyText.match(
          /([\d.]+\s*[kmKM]?)\s*Followers/i
        );

        return {
          name,
          niche,
          location,
          bio: description,
          imageUrl,
          sameAs,
          followerText: followerMatch ? followerMatch[1] : null,
          price: lowPrice ? `$${lowPrice}` : null,
          ratingValue,
          reviewCount,
        };
      });

      // Parse social handles from sameAs
      let instagramHandle: string | null = null;
      let tiktokHandle: string | null = null;
      let website: string | null = null;

      for (const url of data.sameAs) {
        if (url.includes("instagram.com")) {
          const h = extractHandleFromUrl(url, "instagram");
          if (h && h !== "collabstr") instagramHandle = h;
        } else if (url.includes("tiktok.com")) {
          const h = extractHandleFromUrl(url, "tiktok");
          if (h && h !== "collabstr.com" && h !== "i18n")
            tiktokHandle = h;
        } else if (
          url.startsWith("http") &&
          !url.includes("collabstr.com")
        ) {
          website = url;
        }
      }

      return {
        collabstrSlug: slug,
        collabstrUrl: `${BASE_URL}/${slug}`,
        name: data.name,
        niche: data.niche,
        location: data.location,
        bio: data.bio,
        imageUrl: data.imageUrl,
        instagramHandle,
        tiktokHandle,
        website,
        followerCount: parseFollowerCount(data.followerText),
        price: data.price,
        rating: data.ratingValue,
        reviewCount: data.reviewCount,
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error(
        `[profile] Attempt ${attempt}/${MAX_RETRIES} failed for ${slug}:`,
        err instanceof Error ? err.message : err
      );
      if (attempt < MAX_RETRIES) await sleep(5000);
    }
  }

  console.error(`[profile] SKIPPING ${slug} after ${MAX_RETRIES} attempts`);
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { startPage, maxPages, output } = parseArgs();

  console.log("=== Collabstr Influencer Scraper ===");
  console.log(`Output: ${output}`);
  console.log(`Start page: ${startPage}, Max pages: ${maxPages}`);

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const state: CheckpointState = checkpoint || {
    lastPage: startPage - 1,
    lastSlugIndex: -1,
    totalScraped: 0,
    scrapedSlugs: new Set(),
  };

  const effectiveStartPage = checkpoint
    ? checkpoint.lastPage
    : startPage;

  console.log(
    `Resuming from page ${effectiveStartPage}, total scraped so far: ${state.totalScraped}`
  );

  // Launch browser
  const browser: Browser = await chromium.launch({
    headless: false, // Use headed mode to avoid Cloudflare
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    let currentPage = effectiveStartPage;
    let emptyPages = 0;

    while (
      currentPage < effectiveStartPage + maxPages &&
      emptyPages < 3
    ) {
      // Scrape listing page
      const slugs = await scrapeListingPage(page, currentPage);

      if (slugs.length === 0) {
        emptyPages++;
        console.log(
          `[main] Empty page ${currentPage} (${emptyPages}/3 consecutive empties)`
        );
        currentPage++;
        continue;
      }

      emptyPages = 0;

      // Determine starting index within page (for resume)
      const startIdx =
        currentPage === effectiveStartPage && checkpoint
          ? checkpoint.lastSlugIndex + 1
          : 0;

      for (let i = startIdx; i < slugs.length; i++) {
        const slug = slugs[i];

        // Skip already scraped
        if (state.scrapedSlugs.has(slug)) {
          continue;
        }

        // Scrape profile
        const influencer = await scrapeProfilePage(page, slug);

        if (influencer) {
          appendToOutput(output, influencer);
          state.scrapedSlugs.add(slug);
          state.totalScraped++;

          console.log(
            `[${state.totalScraped}] ${influencer.name || slug} | IG: ${influencer.instagramHandle || "—"} | TT: ${influencer.tiktokHandle || "—"} | ${influencer.location || "—"}`
          );
        }

        state.lastPage = currentPage;
        state.lastSlugIndex = i;

        // Checkpoint
        if (state.totalScraped % CHECKPOINT_EVERY === 0) {
          saveCheckpoint(state);
          console.log(
            `[checkpoint] Saved at ${state.totalScraped} profiles (page ${currentPage}, index ${i})`
          );
        }

        await sleep(DELAY_BETWEEN_PROFILES_MS);
      }

      // Save checkpoint at end of page
      saveCheckpoint(state);

      // Report at page boundaries
      if (currentPage % 5 === 0) {
        console.log(
          `\n=== PROGRESS REPORT ===\nPage: ${currentPage}\nTotal scraped: ${state.totalScraped}\nLast profile: ${Array.from(state.scrapedSlugs).pop()}\n========================\n`
        );
      }

      currentPage++;
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }

    console.log(`\n=== SCRAPE COMPLETE ===`);
    console.log(`Total profiles scraped: ${state.totalScraped}`);
    console.log(`Output file: ${output}`);
    console.log(`Pages processed: ${effectiveStartPage} to ${currentPage - 1}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
