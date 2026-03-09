#!/usr/bin/env npx tsx
/**
 * Collabstr influencer scraper.
 *
 * Hard requirements:
 * - deterministic Playwright/browser scraping only
 * - no LLM in the scrape loop
 * - output schema exposes first-class: name, instagram, tiktok, profileDump
 *
 * Usage:
 *   npx tsx scripts/scrape-collabstr.ts [--start-page N] [--max-pages N] [--max-profiles N] [--output path]
 *
 * Checkpointing:
 *   Writes state to scripts/.collabstr-checkpoint.json for resume.
 *
 * Output:
 *   JSONL file at scripts/collabstr-influencers.jsonl by default.
 */

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://collabstr.com";
const LISTING_URL = `${BASE_URL}/influencers`;
const DELAY_BETWEEN_PROFILES_MS = 2000;
const DELAY_BETWEEN_PAGES_MS = 3000;
const CHECKPOINT_EVERY = 10;
const MAX_RETRIES = 3;

interface ScrapedInfluencer {
  name: string | null;
  instagram: string | null;
  tiktok: string | null;
  profileDump: string | null;
  collabstrSlug: string;
  collabstrUrl: string;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
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

interface OutputState {
  totalRecords: number;
  duplicateCount: number;
  invalidCount: number;
  scrapedSlugs: Set<string>;
}

interface ScrapeArgs {
  startPage: number;
  maxPages: number;
  maxProfiles: number | null;
  output: string;
}

interface SocialLinkInfo {
  handle: string | null;
  url: string | null;
}

function parseArgs(): ScrapeArgs {
  const args = process.argv.slice(2);
  let startPage = 1;
  let maxPages = 9999;
  let maxProfiles: number | null = null;
  let output = path.join(__dirname, "collabstr-influencers.jsonl");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-page" && args[i + 1]) {
      startPage = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--max-pages" && args[i + 1]) {
      maxPages = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--max-profiles" && args[i + 1]) {
      maxProfiles = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  return { startPage, maxPages, maxProfiles, output };
}

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanNullableTextDump(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return normalized.length ? normalized : null;
}

function parseSlugFromUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const slug = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    return slug || null;
  } catch {
    return null;
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildInfluencerRecord(input: {
  name: string | null;
  instagram: string | null;
  tiktok: string | null;
  profileDump: string | null;
  collabstrSlug: string;
  collabstrUrl: string;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  website: string | null;
  followerCount: number | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
  scrapedAt: string;
}): ScrapedInfluencer {
  return {
    name: input.name,
    instagram: input.instagram,
    tiktok: input.tiktok,
    profileDump: input.profileDump,
    collabstrSlug: input.collabstrSlug,
    collabstrUrl: input.collabstrUrl,
    niche: input.niche,
    location: input.location,
    bio: input.bio,
    imageUrl: input.imageUrl,
    instagramHandle: input.instagram,
    tiktokHandle: input.tiktok,
    instagramUrl: input.instagramUrl,
    tiktokUrl: input.tiktokUrl,
    website: input.website,
    followerCount: input.followerCount,
    price: input.price,
    rating: input.rating,
    reviewCount: input.reviewCount,
    scrapedAt: input.scrapedAt,
  };
}

function normalizeInfluencer(raw: unknown): ScrapedInfluencer | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const collabstrSlug =
    cleanNullableString(record.collabstrSlug) ||
    parseSlugFromUrl(record.collabstrUrl);

  if (!collabstrSlug) return null;

  const instagram =
    cleanNullableString(record.instagram) ||
    cleanNullableString(record.instagramHandle);
  const tiktok =
    cleanNullableString(record.tiktok) ||
    cleanNullableString(record.tiktokHandle);

  return buildInfluencerRecord({
    name: cleanNullableString(record.name),
    instagram,
    tiktok,
    profileDump: cleanNullableTextDump(record.profileDump),
    collabstrSlug,
    collabstrUrl:
      cleanNullableString(record.collabstrUrl) || `${BASE_URL}/${collabstrSlug}`,
    niche: cleanNullableString(record.niche),
    location: cleanNullableString(record.location),
    bio: cleanNullableString(record.bio),
    imageUrl: cleanNullableString(record.imageUrl),
    instagramUrl:
      cleanNullableString(record.instagramUrl) ||
      (instagram ? `https://www.instagram.com/${instagram}` : null),
    tiktokUrl:
      cleanNullableString(record.tiktokUrl) ||
      (tiktok ? `https://www.tiktok.com/@${tiktok}` : null),
    website: cleanNullableString(record.website),
    followerCount: toFiniteNumber(record.followerCount),
    price: cleanNullableString(record.price),
    rating: toFiniteNumber(record.rating),
    reviewCount: toFiniteNumber(record.reviewCount),
    scrapedAt: cleanNullableString(record.scrapedAt) || new Date().toISOString(),
  });
}

function mergeInfluencers(
  base: ScrapedInfluencer,
  incoming: ScrapedInfluencer
): ScrapedInfluencer {
  const merged = {
    ...base,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, value]) => value !== null)
    ),
  };

  return buildInfluencerRecord({
    name: merged.name,
    instagram: merged.instagram,
    tiktok: merged.tiktok,
    profileDump: merged.profileDump,
    collabstrSlug: base.collabstrSlug,
    collabstrUrl: merged.collabstrUrl || base.collabstrUrl,
    niche: merged.niche,
    location: merged.location,
    bio: merged.bio,
    imageUrl: merged.imageUrl,
    instagramUrl: merged.instagramUrl,
    tiktokUrl: merged.tiktokUrl,
    website: merged.website,
    followerCount: merged.followerCount,
    price: merged.price,
    rating: merged.rating,
    reviewCount: merged.reviewCount,
    scrapedAt: merged.scrapedAt,
  });
}

function getCheckpointPath(output: string): string {
  const parsed = path.parse(output);
  const safeName = parsed.name || "collabstr-influencers";
  return path.join(parsed.dir || __dirname, `.${safeName}.checkpoint.json`);
}

function loadCheckpoint(output: string): CheckpointState | null {
  const cpPath = getCheckpointPath(output);
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

function saveCheckpoint(output: string, state: CheckpointState): void {
  const cpPath = getCheckpointPath(output);
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
  fs.appendFileSync(output, `${JSON.stringify(influencer)}\n`);
}

function writeOutput(output: string, influencers: ScrapedInfluencer[]): void {
  const content =
    influencers.map((influencer) => JSON.stringify(influencer)).join("\n") +
    (influencers.length ? "\n" : "");
  fs.writeFileSync(output, content);
}

function loadExistingOutputState(output: string): OutputState {
  if (!fs.existsSync(output)) {
    return {
      totalRecords: 0,
      duplicateCount: 0,
      invalidCount: 0,
      scrapedSlugs: new Set(),
    };
  }

  const lines = fs
    .readFileSync(output, "utf-8")
    .split("\n")
    .filter((line) => line.trim());

  const deduped = new Map<string, ScrapedInfluencer>();
  let duplicateCount = 0;
  let invalidCount = 0;
  let needsRewrite = false;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const normalized = normalizeInfluencer(parsed);
      if (!normalized) {
        invalidCount++;
        needsRewrite = true;
        continue;
      }

      const normalizedLine = JSON.stringify(normalized);
      if (normalizedLine !== line.trim()) needsRewrite = true;

      const existing = deduped.get(normalized.collabstrSlug);
      if (existing) {
        duplicateCount++;
        deduped.set(
          normalized.collabstrSlug,
          mergeInfluencers(existing, normalized)
        );
        needsRewrite = true;
      } else {
        deduped.set(normalized.collabstrSlug, normalized);
      }
    } catch {
      invalidCount++;
      needsRewrite = true;
    }
  }

  const influencers = Array.from(deduped.values());

  if (needsRewrite) {
    writeOutput(output, influencers);
  }

  return {
    totalRecords: influencers.length,
    duplicateCount,
    invalidCount,
    scrapedSlugs: new Set(influencers.map((record) => record.collabstrSlug)),
  };
}

function parseFollowerCount(text: string | null): number | null {
  if (!text) return null;
  const normalized = text.replace(/,/g, "").trim();
  const match = normalized.match(/([\d.]+)\s*(k|m)?/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;

  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") return Math.round(num * 1_000);
  if (suffix === "m") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function extractHandleFromUrl(
  rawUrl: string,
  platform: "instagram" | "tiktok"
): string | null {
  try {
    const url = new URL(rawUrl);
    const pathPart = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    if (!pathPart) return null;

    if (platform === "tiktok") {
      const firstSegment = pathPart.split("/")[0] || "";
      const handle = firstSegment.replace(/^@/, "");
      return handle || null;
    }

    const firstSegment = pathPart.split("/")[0] || "";
    if (
      ["p", "reel", "reels", "stories", "explore", "accounts", "i18n"].includes(
        firstSegment
      )
    ) {
      return null;
    }

    return firstSegment || null;
  } catch {
    return null;
  }
}

function extractSocialLink(
  urls: string[],
  platform: "instagram" | "tiktok"
): SocialLinkInfo {
  const hostnameMatcher =
    platform === "instagram"
      ? /(^|\.)instagram\.com$/i
      : /(^|\.)tiktok\.com$/i;

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl);
      if (!hostnameMatcher.test(parsed.hostname)) continue;

      const handle = extractHandleFromUrl(rawUrl, platform);
      if (!handle || handle === "collabstr" || handle === "i18n") continue;

      return { handle, url: rawUrl };
    } catch {
      continue;
    }
  }

  return { handle: null, url: null };
}

function extractWebsite(urls: string[]): string | null {
  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      if (/collabstr\.com$/i.test(parsed.hostname)) continue;
      if (/instagram\.com$/i.test(parsed.hostname)) continue;
      if (/tiktok\.com$/i.test(parsed.hostname)) continue;
      return rawUrl;
    } catch {
      continue;
    }
  }

  return null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeListingPage(page: Page, pageNum: number): Promise<string[]> {
  const url = pageNum === 1 ? LISTING_URL : `${LISTING_URL}?pg=${pageNum}`;
  console.log(`[listing] Navigating to page ${pageNum}: ${url}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await sleep(1000);

  const slugs = await page.evaluate(() => {
    const links = document.querySelectorAll("a[href]");
    const result: string[] = [];
    const seen = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("/") &&
        !href.includes("?") &&
        !href.includes("#") &&
        href.split("/").length === 2
      ) {
        const slug = href.slice(1);
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
              if (Array.isArray(item?.provider?.sameAs)) {
                sameAs = sameAs.concat(item.provider.sameAs);
              }
              if (item?.provider?.name && !name) name = item.provider.name;
              if (item?.provider?.image && !imageUrl) imageUrl = item.provider.image;
              if (item?.brand?.name && !name) name = item.brand.name;
              if (Array.isArray(item?.image) && item.image[0] && !imageUrl) {
                imageUrl = item.image[0];
              }
              if (typeof item?.description === "string") description = item.description;
              if (typeof item?.areaServed?.name === "string") {
                location = item.areaServed.name;
              }
              if (typeof item?.offers?.lowPrice === "string") {
                lowPrice = item.offers.lowPrice;
              }
              if (item?.aggregateRating) {
                ratingValue =
                  typeof item.aggregateRating.ratingValue === "number"
                    ? item.aggregateRating.ratingValue
                    : ratingValue;
                reviewCount =
                  typeof item.aggregateRating.reviewCount === "number"
                    ? item.aggregateRating.reviewCount
                    : reviewCount;
              }
            }
          } catch {
            // Ignore malformed JSON-LD blocks.
          }
        });

        const h1s = Array.from(document.querySelectorAll("h1"));
        let niche: string | null = null;
        h1s.forEach((h1) => {
          const text = h1.textContent?.trim() || "";
          if (text && text !== name && !niche) {
            niche = text;
          }
        });

        const bodyText = document.body?.innerText || document.body?.textContent || "";
        const followerMatches = Array.from(
          bodyText.matchAll(/([\d.,]+\s*[kmKM]?)\s*Followers/gi)
        ).map((match) => match[1]);
        const nonZeroFollowerText = followerMatches.find((value) => {
          const digits = value.replace(/[^\d]/g, "");
          return digits.length > 0 && Number(digits) > 0;
        });

        return {
          name,
          niche,
          location,
          bio: description,
          imageUrl,
          sameAs,
          followerText: nonZeroFollowerText || followerMatches[0] || null,
          price: lowPrice ? `$${lowPrice}` : null,
          ratingValue,
          reviewCount,
          profileDump: bodyText || null,
        };
      });

      const hasCreatorSignals = Boolean(
        data.name ||
          data.location ||
          data.bio ||
          data.imageUrl ||
          data.price ||
          (data.sameAs || []).length
      );

      if (!hasCreatorSignals) {
        console.log(`[profile] Skipping non-creator page: ${slug}`);
        return null;
      }

      const candidateUrls = Array.from(new Set(data.sameAs || []));

      const instagram = extractSocialLink(candidateUrls, "instagram");
      const tiktok = extractSocialLink(candidateUrls, "tiktok");
      const website = extractWebsite(candidateUrls);

      return buildInfluencerRecord({
        name: data.name,
        instagram: instagram.handle,
        tiktok: tiktok.handle,
        profileDump: cleanNullableTextDump(data.profileDump),
        collabstrSlug: slug,
        collabstrUrl: url,
        niche: data.niche,
        location: data.location,
        bio: data.bio,
        imageUrl: data.imageUrl,
        instagramUrl: instagram.url,
        tiktokUrl: tiktok.url,
        website,
        followerCount: parseFollowerCount(data.followerText),
        price: data.price,
        rating: data.ratingValue,
        reviewCount: data.reviewCount,
        scrapedAt: new Date().toISOString(),
      });
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

async function main() {
  const { startPage, maxPages, maxProfiles, output } = parseArgs();

  console.log("=== Collabstr Influencer Scraper ===");
  console.log(`Output: ${output}`);
  console.log(`Start page: ${startPage}, Max pages: ${maxPages}`);
  console.log(
    `Max profiles this run: ${maxProfiles === null ? "unbounded" : maxProfiles}`
  );

  const existingOutputState = loadExistingOutputState(output);
  if (existingOutputState.duplicateCount || existingOutputState.invalidCount) {
    console.log(
      `[output] normalized existing JSONL | deduped=${existingOutputState.duplicateCount} invalid=${existingOutputState.invalidCount}`
    );
  }

  const checkpoint = loadCheckpoint(output);
  const baseState: CheckpointState = checkpoint || {
    lastPage: startPage - 1,
    lastSlugIndex: -1,
    totalScraped: 0,
    scrapedSlugs: new Set<string>(),
  };

  const state: CheckpointState = {
    lastPage: baseState.lastPage,
    lastSlugIndex: baseState.lastSlugIndex,
    totalScraped: Math.max(baseState.totalScraped, existingOutputState.totalRecords),
    scrapedSlugs: new Set([
      ...Array.from(existingOutputState.scrapedSlugs),
      ...Array.from(baseState.scrapedSlugs),
    ]),
  };

  const effectiveStartPage = checkpoint ? checkpoint.lastPage : startPage;

  console.log(
    `Resuming from page ${effectiveStartPage}, total known records: ${state.totalScraped}`
  );

  const browser: Browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  let scrapedThisRun = 0;

  try {
    let currentPage = effectiveStartPage;
    let emptyPages = 0;

    while (currentPage < effectiveStartPage + maxPages && emptyPages < 3) {
      if (maxProfiles !== null && scrapedThisRun >= maxProfiles) {
        console.log(`[main] Reached --max-profiles=${maxProfiles}`);
        break;
      }

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

      const startIdx =
        currentPage === effectiveStartPage && checkpoint
          ? checkpoint.lastSlugIndex + 1
          : 0;

      for (let i = startIdx; i < slugs.length; i++) {
        if (maxProfiles !== null && scrapedThisRun >= maxProfiles) {
          console.log(`[main] Reached --max-profiles=${maxProfiles}`);
          break;
        }

        const slug = slugs[i];
        if (state.scrapedSlugs.has(slug)) continue;

        const influencer = await scrapeProfilePage(page, slug);
        if (influencer) {
          appendToOutput(output, influencer);
          state.scrapedSlugs.add(slug);
          state.totalScraped++;
          scrapedThisRun++;

          console.log(
            `[${state.totalScraped}] ${influencer.name || slug} | IG: ${influencer.instagram || "—"} | TT: ${influencer.tiktok || "—"} | dump: ${influencer.profileDump ? `${influencer.profileDump.length} chars` : "—"}`
          );
        }

        state.lastPage = currentPage;
        state.lastSlugIndex = i;

        if (state.totalScraped % CHECKPOINT_EVERY === 0) {
          saveCheckpoint(output, state);
          console.log(
            `[checkpoint] Saved at ${state.totalScraped} profiles (page ${currentPage}, index ${i})`
          );
        }

        await sleep(DELAY_BETWEEN_PROFILES_MS);
      }

      saveCheckpoint(output, state);

      if (currentPage % 5 === 0) {
        console.log(
          `\n=== PROGRESS REPORT ===\nPage: ${currentPage}\nTotal known records: ${state.totalScraped}\nNew this run: ${scrapedThisRun}\n========================\n`
        );
      }

      if (maxProfiles !== null && scrapedThisRun >= maxProfiles) {
        break;
      }

      currentPage++;
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }

    console.log(`\n=== SCRAPE COMPLETE ===`);
    console.log(`Total known records: ${state.totalScraped}`);
    console.log(`New records this run: ${scrapedThisRun}`);
    console.log(`Output file: ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
