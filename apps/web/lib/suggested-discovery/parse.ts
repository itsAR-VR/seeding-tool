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

/**
 * Normalize any user-supplied handle form ("@name", full URLs,
 * trailing slashes) into a bare lowercase handle, or null if invalid.
 */
export function normalizeIgHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  const urlMatch = value.match(/instagram\.com\/([^/?#]+)/i);
  if (urlMatch) {
    value = urlMatch[1];
  }
  value = value.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();

  if (!HANDLE_PATTERN.test(value)) return null;
  return value;
}

/** Extract "1,234 posts / 56.7K followers / 912 following" counts from header text. */
export function parseHeaderCounts(headerText: string): HeaderCounts {
  const counts: HeaderCounts = { posts: null, followers: null, following: null };
  const pattern = /([\d.,]+[KMBkmb]?)\s*(posts?|followers?|following)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(headerText)) !== null) {
    const value = parseInstagramCountText(match[1]);
    if (value === null) continue;
    const label = match[2].toLowerCase();
    if (label.startsWith("post")) counts.posts = value;
    else if (label.startsWith("follower")) counts.followers = value;
    else counts.following = value;
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
    .filter((line) => !/([\d.,]+[KMBkmb]?)\s*(posts?|followers?|following)/i.test(line))
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

  const counts = parseHeaderCounts(description);
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
