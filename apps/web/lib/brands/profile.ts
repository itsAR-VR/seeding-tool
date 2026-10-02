const BLOCK_TAGS = /<(\/)?(article|section|div|p|h1|h2|h3|h4|h5|h6|li|br|tr|td|blockquote)[^>]*>/gi;
const STRIP_TAGS = /<[^>]+>/g;
const REMOVE_TAG_BLOCKS = /<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi;
const IMAGE_TAG = /<img\b[^>]*>/gi;
const TRACKING_IMAGE_PATTERN =
  /(pixel|spacer|tracking|analytics|doubleclick|facebook\.com\/tr|google-analytics)/i;

export type BrandProfileAnalysisStatus = "complete" | "partial";

export interface BrandBusinessDna {
  brandSummary: string | null;
  targetAudience: string | null;
  audience: string | null;
  niche: string | null;
  category: string | null;
  industry: string | null;
  tone: string | null;
  brandVoice: string | null;
  keyProducts: string[];
  proofSignals: string[];
  keywords: string[];
  visualDirection: string[];
  imageCandidates: string[];
}

export interface BrandProfileSnapshot {
  sourceUrl: string;
  domain: string;
  fetchedAt: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  heroHeadings: string[];
  heroImageCandidates: string[];
  textSignals: string[];
  bodyExcerpt: string | null;
  businessDna?: BrandBusinessDna | null;
  analysisStatus?: BrandProfileAnalysisStatus;
  analysisModel?: string | null;
  analyzedAt?: string | null;
  analysisNote?: string | null;
  brandSummary?: string | null;
  targetAudience?: string | null;
  audience?: string | null;
  niche?: string | null;
  category?: string | null;
  industry?: string | null;
  tone?: string | null;
  brandVoice?: string | null;
  keyProducts?: string[];
  proofSignals?: string[];
  keywords?: string[];
  visualDirection?: string[];
  imageCandidates?: string[];
}

/** Websites bigger than this are cut off; the useful signals are near the top. */
const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;

export function normalizeBrandWebsiteUrl(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  // People type "yourbrand.com" far more often than "https://yourbrand.com".
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Enter a website like yourbrand.com, or leave it empty.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Use a website address that starts with http:// or https://.");
  }

  // A real public site has a dot in its name ("asdf" or "my brand" isn't one).
  if (!url.hostname.includes(".") || /\s/.test(trimmed)) {
    throw new Error("Enter a website like yourbrand.com, or leave it empty.");
  }

  url.hash = "";
  return url.toString();
}

/** Never read the server's own network (localhost, private ranges, cloud metadata). */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  if (host.includes(":")) {
    // IPv6 literal: loopback, unique-local, link-local, or IPv4-mapped.
    return host === "::1" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:");
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Reads at most `maxBytes` of the body, so a huge page can't exhaust memory. */
async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = "";
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return html + decoder.decode();
}

export async function fetchBrandProfile(
  websiteUrl: string
): Promise<BrandProfileSnapshot> {
  if (isPrivateHost(new URL(websiteUrl).hostname)) {
    throw new Error("Website is not a public address");
  }

  // One deadline covers connecting, redirects and reading the body.
  const response = await fetch(websiteUrl, {
    headers: {
      "user-agent": "SeedScale/brand-profile-fetcher (+https://seedscale.local)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.url && isPrivateHost(new URL(response.url).hostname)) {
    throw new Error("Website redirected to a non-public address");
  }

  if (!response.ok) {
    throw new Error(`Website fetch failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
    throw new Error("Website fetch did not return HTML");
  }

  const html = await readCappedText(response, MAX_HTML_BYTES);
  return extractBrandProfileFromHtml(html, response.url || websiteUrl);
}

export function extractBrandProfileFromHtml(
  html: string,
  pageUrl: string
): BrandProfileSnapshot {
  const normalizedUrl = normalizeBrandWebsiteUrl(pageUrl);
  if (!normalizedUrl) {
    throw new Error("Website URL must be a valid http(s) URL");
  }

  const title = extractTagText(html, "title");
  const description =
    extractMetaContent(html, "name", "description") ??
    extractMetaContent(html, "property", "og:description");
  const siteName = extractMetaContent(html, "property", "og:site_name");
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const ogDescription = extractMetaContent(html, "property", "og:description");
  const ogImage = resolveMaybeRelativeUrl(
    normalizedUrl,
    extractMetaContent(html, "property", "og:image")
  );
  const twitterTitle = extractMetaContent(html, "name", "twitter:title");
  const twitterDescription = extractMetaContent(
    html,
    "name",
    "twitter:description"
  );
  const twitterImage = resolveMaybeRelativeUrl(
    normalizedUrl,
    extractMetaContent(html, "name", "twitter:image")
  );
  const heroImageCandidates = extractHeroImageCandidates(html, normalizedUrl);

  const heroHeadings = [
    ...extractHeadingTexts(html, "h1", 2),
    ...extractHeadingTexts(html, "h2", 4),
  ].slice(0, 5);

  const textSignals = extractVisibleTextSignals(html, 8);
  const bodyExcerpt =
    textSignals.length > 0 ? textSignals.join(" ").slice(0, 1200) : null;

  return {
    sourceUrl: normalizedUrl,
    domain: new URL(normalizedUrl).hostname.replace(/^www\./, ""),
    fetchedAt: new Date().toISOString(),
    title,
    description,
    siteName,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    heroHeadings,
    heroImageCandidates,
    textSignals,
    bodyExcerpt,
  };
}

export function listBrandImageCandidates(
  profile:
    | Pick<BrandProfileSnapshot, "ogImage" | "twitterImage" | "heroImageCandidates">
    | null
    | undefined
) {
  if (!profile) {
    return [];
  }

  return Array.from(
    new Set(
      [profile.ogImage, profile.twitterImage, ...(profile.heroImageCandidates ?? [])]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim())
    )
  );
}

function extractMetaContent(
  html: string,
  attribute: "name" | "property",
  value: string
): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*${attribute}=["']${escapeRegExp(value)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*${attribute}=["']${escapeRegExp(value)}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
}

function extractTagText(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, "i"));
  return match?.[1] ? cleanText(match[1]) : null;
}

function extractHeadingTexts(
  html: string,
  tagName: string,
  limit: number
): string[] {
  const matches = html.matchAll(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, "gi")
  );

  const headings: string[] = [];
  for (const match of matches) {
    const cleaned = cleanText(match[1] ?? "");
    if (cleaned && cleaned.length >= 3 && !headings.includes(cleaned)) {
      headings.push(cleaned);
    }
    if (headings.length >= limit) {
      break;
    }
  }

  return headings;
}

function extractVisibleTextSignals(html: string, limit: number): string[] {
  const withoutBlockedTags = html.replace(REMOVE_TAG_BLOCKS, " ");
  const withLineBreaks = withoutBlockedTags.replace(BLOCK_TAGS, "\n");
  const withoutTags = withLineBreaks.replace(STRIP_TAGS, " ");
  const decoded = decodeHtmlEntities(withoutTags);

  const lines = decoded
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter((line) => line.length >= 24)
    .filter((line, index, all) => all.indexOf(line) === index);

  return lines.slice(0, limit);
}

function extractHeroImageCandidates(html: string, baseUrl: string): string[] {
  const scopedHtml = extractScopedImageHtml(html);
  if (!scopedHtml) {
    return [];
  }

  const matches = scopedHtml.matchAll(IMAGE_TAG);
  const candidates: string[] = [];

  for (const match of matches) {
    const tag = match[0] ?? "";
    const candidate = resolveMaybeRelativeUrl(
      baseUrl,
      extractImageSource(tag)
    );

    if (!candidate || shouldSkipImageCandidate(tag, candidate)) {
      continue;
    }

    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }

    if (candidates.length >= 5) {
      break;
    }
  }

  return candidates;
}

function extractScopedImageHtml(html: string): string | null {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const sectionMatch = html.match(/<section\b[^>]*>([\s\S]*?)<\/section>/i);
  return sectionMatch?.[1] ?? null;
}

function extractImageSource(tag: string): string | null {
  const directSource =
    extractAttribute(tag, "src") ??
    extractAttribute(tag, "data-src") ??
    extractAttribute(tag, "data-lazy-src");

  if (directSource) {
    return cleanText(directSource);
  }

  const srcset = extractAttribute(tag, "srcset");
  if (!srcset) {
    return null;
  }

  const firstCandidate = srcset
    .split(",")
    .map((entry) => cleanText(entry.split(/\s+/)[0] ?? ""))
    .find(Boolean);

  return firstCandidate ?? null;
}

function shouldSkipImageCandidate(tag: string, candidate: string): boolean {
  if (!candidate.trim()) {
    return true;
  }

  if (
    candidate.startsWith("data:image/svg+xml") ||
    /\.svg(?:\?|#|$)/i.test(candidate)
  ) {
    return true;
  }

  if (TRACKING_IMAGE_PATTERN.test(candidate)) {
    return true;
  }

  const width = parseDimensionAttribute(tag, "width");
  const height = parseDimensionAttribute(tag, "height");

  if ((width !== null && width < 100) || (height !== null && height < 100)) {
    return true;
  }

  return false;
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim() || nullValueToEmpty();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function resolveMaybeRelativeUrl(
  baseUrl: string,
  candidate?: string | null
): string | null {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

function extractAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(
    new RegExp(`${attribute}=["']([^"']+)["']`, "i")
  );

  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

function parseDimensionAttribute(
  tag: string,
  attribute: "width" | "height"
): number | null {
  const value = extractAttribute(tag, attribute);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nullValueToEmpty(): string {
  return "";
}
