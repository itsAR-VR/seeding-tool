/**
 * Suggested Discovery — Instagram suggested-profile walker (CLI only).
 *
 * Opens a seed profile in a persistent Playwright session, expands the
 * "Suggested for you" rail, visits each suggested profile, and captures
 * structured fields + a header screenshot per profile.
 *
 * Bot-protection posture mirrors scripts/scrape-collabstr.ts: real
 * Chromium, desktop UA, fixed viewport, human pacing. Login is manual
 * and one-time (`--login`); the session persists under .auth/instagram.
 *
 * Instagram's DOM is obfuscated and shifts often, so selectors are
 * layered fallbacks and every failure is captured per candidate rather
 * than crashing the run.
 *
 * IMPORTANT: never import this module from Next.js routes — it pulls
 * playwright into the server bundle. The API spawns the CLI instead.
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import { getSessionDir } from "./store";
import {
  normalizeIgHandle,
  parseHeaderText,
  parseMetaDescription,
} from "./parse";
import type { SuggestedProfile } from "./types";

const IG_BASE = "https://www.instagram.com";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT_MS = 30_000;
const PROFILE_DELAY_MS = 2_500;

export class NeedsLoginError extends Error {
  constructor() {
    super(
      "Instagram session is logged out. Run: npm run discover:suggested -- --login"
    );
    this.name = "NeedsLoginError";
  }
}

export interface WalkCallbacks {
  onProfile: (profile: SuggestedProfile, screenshot: Buffer | null) => Promise<void> | void;
  onProfileError?: (handle: string, error: Error) => Promise<void> | void;
  log?: (message: string) => void;
}

export interface WalkOptions {
  seedHandle: string;
  maxProfiles: number;
  headless?: boolean;
  sessionDir?: string;
}

interface RawHeaderSnapshot {
  headerText: string;
  isVerified: boolean;
  externalUrl: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchSession(headless: boolean, sessionDir?: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(sessionDir ?? getSessionDir(), {
    headless,
    viewport: VIEWPORT,
    userAgent: DESKTOP_UA,
    locale: "en-US",
    timezoneId: "America/Toronto",
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

async function assertLoggedIn(page: Page): Promise<void> {
  if (page.url().includes("/accounts/login")) throw new NeedsLoginError();
  const loginWall = await page
    .getByText(/log in to instagram/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (loginWall) throw new NeedsLoginError();
}

/**
 * Expand the suggested-profile rail. The entry point is the chevron
 * button beside Follow/Message on the profile header; on some layouts
 * the rail is already rendered below the header.
 */
async function expandSuggestions(page: Page): Promise<void> {
  const alreadyVisible = await page
    .getByText(/suggested for you/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (alreadyVisible) return;

  const triggers = [
    'button[aria-label*="imilar" i]',
    'div[role="button"][aria-label*="imilar" i]',
    'button[aria-label*="uggested" i]',
  ];
  for (const selector of triggers) {
    const trigger = page.locator(selector).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => undefined);
      break;
    }
  }
  await page
    .getByText(/suggested for you/i)
    .first()
    .waitFor({ timeout: 8_000 })
    .catch(() => undefined);
}

/**
 * Collect suggested profile handles, scoped to the expanded
 * "Suggested for you" rail. Scanning the whole page would pull in
 * unrelated profile links (e.g. "Followed by" accounts), so if the
 * rail cannot be located we return nothing and the caller fails closed.
 */
async function collectSuggestedHandles(page: Page, limit: number): Promise<string[]> {
  const handles = await page.evaluate(() => {
    const marker = Array.from(
      document.querySelectorAll<HTMLElement>("span, div")
    ).find(
      (el) =>
        el.children.length === 0 && /suggested for you/i.test(el.textContent ?? "")
    );
    if (!marker) return [];

    // Walk up from the marker to the smallest ancestor that holds the
    // profile cards (several handle links), then collect only within it.
    // Fail closed: if no ancestor qualifies, return nothing rather than
    // scanning an unchecked page-level wrapper.
    const PROFILE_HREF = /^\/([a-z0-9._]{1,30})\/?$/i;
    let container: HTMLElement | null = marker.parentElement;
    let found = false;
    for (let depth = 0; container && depth < 6; depth += 1) {
      const links = Array.from(
        container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
      ).filter((anchor) => PROFILE_HREF.test(anchor.getAttribute("href") ?? ""));
      if (links.length >= 2) {
        found = true;
        break;
      }
      container = container.parentElement;
    }
    if (!container || !found) return [];

    const out: string[] = [];
    for (const anchor of Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
    )) {
      const match = anchor.getAttribute("href")?.match(PROFILE_HREF);
      if (match) out.push(match[1].toLowerCase());
    }
    return out;
  });

  const seen = new Set<string>();
  const seed = normalizeIgHandle(page.url().split("instagram.com/")[1] ?? "");
  const unique: string[] = [];
  for (const handle of handles) {
    if (handle === seed || seen.has(handle)) continue;
    // Skip nav chrome links that match the handle pattern (explore, reels, ...)
    if (["explore", "reels", "direct", "accounts", "p", "reel"].includes(handle)) continue;
    seen.add(handle);
    unique.push(handle);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function snapshotHeader(page: Page): Promise<RawHeaderSnapshot> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const headerText = (header as HTMLElement | null)?.innerText ?? "";
    const isVerified = Boolean(
      document.querySelector('header svg[aria-label="Verified"], header [title="Verified"]')
    );
    // Instagram wraps outbound links as l.instagram.com/?u=<url> — unwrap
    // the redirect instead of discarding it as an Instagram-internal link.
    let externalUrl: string | null = null;
    for (const anchor of Array.from(
      document.querySelectorAll<HTMLAnchorElement>('header a[href^="http"]')
    )) {
      try {
        const url = new URL(anchor.href);
        if (url.hostname === "l.instagram.com" && url.searchParams.get("u")) {
          // URLSearchParams.get already decodes — a second decode would
          // corrupt targets containing encoded values or literal percents.
          externalUrl = url.searchParams.get("u");
          break;
        }
        if (!/instagram\.com|facebook\.com|fb\.com/.test(url.hostname)) {
          externalUrl = anchor.href;
          break;
        }
      } catch {
        // unparsable href — skip
      }
    }
    return {
      headerText,
      isVerified,
      externalUrl,
    };
  });
}

async function screenshotHeader(page: Page): Promise<Buffer | null> {
  const header = page.locator("header").first();
  try {
    const box = await header.boundingBox({ timeout: 5_000 });
    if (!box) return null;
    // The verdict prompt judges "visible content themes", so the capture
    // must include the first post-grid rows, not just header metadata.
    // Clip from the header's top edge ~900px past its bottom edge.
    const clip = {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, VIEWPORT.width),
      height: Math.min(box.height + 900, 1_800),
    };
    return (await page.screenshot({ clip })) as Buffer;
  } catch {
    try {
      return (await page.screenshot({
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: 1_200 },
      })) as Buffer;
    } catch {
      return null;
    }
  }
}

async function scrapeProfile(
  page: Page,
  handle: string,
  discoveredFrom: string
): Promise<{ profile: SuggestedProfile; screenshot: Buffer | null }> {
  await page.goto(`${IG_BASE}/${handle}/`, {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT_MS,
  });
  // A session can expire mid-walk: never let a login redirect be parsed
  // as an empty profile.
  await assertLoggedIn(page);
  const headerFound = await page
    .waitForSelector("header", { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!headerFound) {
    // 404, challenge page, network failure, or DOM change — a scrape
    // error, not an empty profile to classify as "rejected".
    throw new Error(`Profile header not found for @${handle}`);
  }
  await sleep(1_000); // let counts/bio hydrate

  const snapshot = await snapshotHeader(page);
  const html = await page.content();
  const fromHeader = parseHeaderText(snapshot.headerText, handle);
  const fromMeta = parseMetaDescription(html);

  const profile: SuggestedProfile = {
    handle,
    displayName: fromHeader.displayName ?? fromMeta?.displayName ?? null,
    bio: fromHeader.bio,
    category: fromHeader.category,
    followers: fromHeader.followers ?? fromMeta?.followers ?? null,
    following: fromHeader.following ?? fromMeta?.following ?? null,
    posts: fromHeader.posts ?? fromMeta?.posts ?? null,
    externalUrl: snapshot.externalUrl,
    isVerified: snapshot.isVerified,
    profileUrl: `${IG_BASE}/${handle}/`,
    discoveredFrom,
    screenshotFile: null,
  };

  const screenshot = await screenshotHeader(page);
  return { profile, screenshot };
}

/**
 * Walk the suggested rail of a seed profile. Calls onProfile per
 * successfully scraped suggestion so callers can persist incrementally.
 */
export async function walkSuggestedProfiles(
  options: WalkOptions,
  callbacks: WalkCallbacks
): Promise<{ visited: number }> {
  const seed = normalizeIgHandle(options.seedHandle);
  if (!seed) throw new Error(`Invalid seed handle: ${options.seedHandle}`);
  const log = callbacks.log ?? (() => undefined);

  const context = await launchSession(options.headless ?? true, options.sessionDir);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    log(`Opening seed profile @${seed}`);
    await page.goto(`${IG_BASE}/${seed}/`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await assertLoggedIn(page);

    await expandSuggestions(page);
    const handles = await collectSuggestedHandles(page, options.maxProfiles);
    if (handles.length === 0) {
      throw new Error(
        `No suggested profiles found for @${seed} — Instagram may not have rendered the rail. Try --headful to inspect.`
      );
    }
    log(`Found ${handles.length} suggested profiles`);

    let visited = 0;
    for (const handle of handles) {
      try {
        const { profile, screenshot } = await scrapeProfile(page, handle, seed);
        await callbacks.onProfile(profile, screenshot);
        visited += 1;
        log(`Scraped @${handle} (${visited}/${handles.length})`);
      } catch (error) {
        if (error instanceof NeedsLoginError) throw error;
        await callbacks.onProfileError?.(
          handle,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      await sleep(PROFILE_DELAY_MS);
    }
    return { visited };
  } finally {
    await context.close();
  }
}

/**
 * One-time manual login: opens a headed browser on instagram.com and
 * waits until the session is authenticated, then closes. The profile
 * directory persists, so later headless runs reuse it.
 */
export async function openLoginSession(sessionDir?: string): Promise<void> {
  const context = await launchSession(false, sessionDir);
  const page = await context.newPage();
  await page.goto(IG_BASE, { waitUntil: "domcontentloaded" });
  console.log(
    "Log in to Instagram in the opened window. This session is reused by discovery runs."
  );

  for (let attempt = 0; attempt < 120; attempt += 1) {
    // Require a strong authenticated-UI signal: the app nav only renders
    // when logged in. Profile pictures are NOT proof — logged-out pages
    // can show them too.
    const authed = await page
      .evaluate(() =>
        Boolean(
          document.querySelector('svg[aria-label="Home"]') ||
            document.querySelector('a[href*="/direct/"]')
        )
      )
      .catch(() => false);
    if (authed) {
      console.log("Login detected — session saved.");
      await context.close();
      return;
    }
    await sleep(2_000);
  }

  await context.close();
  throw new Error("Timed out waiting for login (4 minutes). Re-run --login to retry.");
}
