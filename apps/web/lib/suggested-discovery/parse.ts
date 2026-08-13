/**
 * Suggested Discovery — pure parsing helpers.
 *
 * Everything here is side-effect free so it can be unit-tested without
 * a browser and safely bundled into the demo-mode API path.
 *
 * Instagram's profile DOM is obfuscated and changes often, so the
 * walker captures two raw artifacts per profile and these helpers do
 * the interpretation:
 *   1. `headerText`  — innerText of the profile <header> block
 *   2. page HTML meta — og:title / og:description (stable contract)
 */

import { parseInstagramCountText } from "@/lib/instagram/profile-html";

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;

/** Button labels that leak into header innerText and must be ignored. */
const HEADER_NOISE_LINES = new Set([
  "follow",
  "following",
  "message",
  "subscribe",
  "contact",
  "notes",
  "suggested",
  "call",
  "email",
]);

export interface HeaderCounts {
  posts: number | null;
  followers: number | null;
  following: number | null;
}

export interface ParsedProfileHeader extends HeaderCounts {
  displayName: string | null;
  category: string | null;
  bio: string | null;
}

/** Instagram routes that look like handles but are not profiles. */
const RESERVED_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "accounts",
  "direct",
  "stories",
  "tv",
  "legal",
  "developer",
]);

/**
 * Normalize any user-supplied handle form ("@name", profile URLs) into a
 * bare lowercase handle, or null if invalid. URLs are parsed explicitly:
 * the hostname must be Instagram and the path must be a bare profile
 * segment — "/p/…" posts, "/explore", and lookalike hosts are rejected.
 */
export function normalizeIgHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  if (/instagram\.com/i.test(value) || /^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== "instagram.com" && host !== "www.instagram.com") return null;
    value = url.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  value = value.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();

  if (RESERVED_SEGMENTS.has(value)) return null;
  if (!HANDLE_PATTERN.test(value)) return null;
  return value;
}

const COUNT_LINE_PATTERN = /^([\d.,]+[KMBkmb]?)\s*(posts?|followers?|following)\b/i;
const COUNT_PAIR_PATTERN = /([\d.,]+[KMBkmb]?)\s*(posts?|followers?|following)\b/gi;

function applyCountMatch(counts: HeaderCounts, match: RegExpMatchArray): void {
  const value = parseInstagramCountText(match[1]);
  if (value === null) return;
  const label = match[2].toLowerCase();
  // First hit per label wins — a bio line like "Helping 50K followers
  // grow" must not overwrite the real header count parsed earlier.
  if (label.startsWith("post") && counts.posts === null) counts.posts = value;
  else if (label.startsWith("follower") && counts.followers === null)
    counts.followers = value;
  else if (label.startsWith("following") && counts.following === null)
    counts.following = value;
}

function applyCountSegment(counts: HeaderCounts, segment: string): void {
  const match = segment.trim().match(COUNT_LINE_PATTERN);
  if (match) applyCountMatch(counts, match);
}

/** Extract "1,234 posts / 56.7K followers / 912 following" counts from header text. */
export function parseHeaderCounts(headerText: string): HeaderCounts {
  const counts: HeaderCounts = { posts: null, followers: null, following: null };
  for (const line of headerText.split("\n")) {
    applyCountSegment(counts, line);
  }
  return counts;
}

/**
 * Heuristic layout parse of a profile header's innerText.
 *
 * Typical shape once count lines and action buttons are removed:
 *   [username/verified line] [display name] [category?] [bio lines...] [link text?]
 *
 * The username line is dropped using the known handle. The first
 * remaining line is the display name; a short second line that does
 * not look like a URL or bio sentence is treated as the IG category.
 */
export function parseHeaderText(headerText: string, handle: string): ParsedProfileHeader {
  const counts = parseHeaderCounts(headerText);

  const lines = headerText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !COUNT_LINE_PATTERN.test(line))
    .filter((line) => !HEADER_NOISE_LINES.has(line.toLowerCase()))
    .filter((line) => line.toLowerCase() !== handle)
    .filter((line) => line.toLowerCase() !== `@${handle}`)
    .filter((line) => !/^followed by /i.test(line));

  const displayName = lines[0] ?? null;

  let category: string | null = null;
  let bioLines = lines.slice(1);
  const maybeCategory = bioLines[0];
  if (
    maybeCategory &&
    maybeCategory.length <= 40 &&
    !maybeCategory.includes("http") &&
    !/[.!?…]/.test(maybeCategory) &&
    bioLines.length > 1
  ) {
    category = maybeCategory;
    bioLines = bioLines.slice(1);
  }

  const bio =
    bioLines
      .filter((line) => !/^https?:\/\//i.test(line))
      .join("\n")
      .trim() || null;

  return { ...counts, displayName, category, bio };
}

/**
 * Parse Instagram's stable meta contract:
 *   og:description = "56K Followers, 900 Following, 120 Posts - See Instagram photos and videos from Display Name (@handle)"
 */
export function parseMetaDescription(html: string): ParsedProfileHeader | null {
  const description = extractMetaContent(html, "og:description");
  if (!description) return null;

  // Counts live in the lead: "84.2K Followers, 610 Following, 431 Posts
  // - See Instagram photos and videos from ...". Match full <number>
  // <label> pairs — comma-splitting would break comma-grouped numbers
  // like "1,234 Followers".
  const counts: HeaderCounts = { posts: null, followers: null, following: null };
  const countSection = description.split(" - ")[0] ?? "";
  for (const match of countSection.matchAll(COUNT_PAIR_PATTERN)) {
    applyCountMatch(counts, match);
  }
  const nameMatch = description.match(/from\s+(.+?)\s*\(@([a-z0-9._]+)\)\s*$/i);

  return {
    ...counts,
    displayName: nameMatch?.[1] ?? null,
    category: null,
    bio: null,
  };
}

export function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
