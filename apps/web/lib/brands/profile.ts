const BLOCK_TAGS = /<(\/)?(article|section|div|p|h1|h2|h3|h4|h5|h6|li|br|tr|td|blockquote)[^>]*>/gi;
const STRIP_TAGS = /<[^>]+>/g;
const REMOVE_TAG_BLOCKS = /<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi;

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
  textSignals: string[];
  bodyExcerpt: string | null;
}

export function normalizeBrandWebsiteUrl(rawUrl?: string | null): string | null {
  if (!rawUrl?.trim()) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Website URL must be a valid http(s) URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Website URL must start with http:// or https://");
  }

  url.hash = "";
  return url.toString();
}

export async function fetchBrandProfile(
  websiteUrl: string
): Promise<BrandProfileSnapshot> {
  const response = await fetch(websiteUrl, {
    headers: {
      "user-agent": "SeedScale/brand-profile-fetcher (+https://seedscale.local)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Website fetch failed with ${response.status}`);
  }

  const html = await response.text();
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
    textSignals,
    bodyExcerpt,
  };
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nullValueToEmpty(): string {
  return "";
}
