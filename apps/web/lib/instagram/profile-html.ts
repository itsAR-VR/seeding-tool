const COUNT_MULTIPLIERS: Record<string, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
};

function normalizeCountText(value: string) {
  let normalized = value
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/followers?/gi, "")
    .replace(/[+]/g, "");

  if (/^\d{1,3}(,\d{3})+(\.\d+)?[KMB]?$/i.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?[KMB]?$/i.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  return normalized.toUpperCase();
}

export function parseInstagramCountText(value: string) {
  const normalized = normalizeCountText(value);
  const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);

  if (!match) {
    return null;
  }

  const baseValue = Number(match[1]);
  if (!Number.isFinite(baseValue)) {
    return null;
  }

  const multiplier = match[2] ? COUNT_MULTIPLIERS[match[2]] : 1;
  return Math.round(baseValue * multiplier);
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMetaContent(html: string, name: string) {
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
    if (match?.[1]) {
      return decodeHtmlAttribute(match[1]);
    }
  }

  return null;
}

function extractNormalizedInstagramUrls(matches: Iterable<string>) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const normalized = match
      .replace(/\\\//g, "/")
      .replace(/^https?:\/\/(www\.)?instagram\.com/i, "https://www.instagram.com")
      .replace(/^\/+/, "");

    const url = normalized.startsWith("http")
      ? normalized
      : `https://www.instagram.com/${normalized}`;

    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

export function extractInstagramFollowerCountFromHtml(html: string) {
  const jsonPatterns = [
    /"edge_followed_by"\s*:\s*\{"count"\s*:\s*(\d+)/i,
    /"followers_count"\s*:\s*(\d+)/i,
    /"follower_count"\s*:\s*(\d+)/i,
    /"followed_by"\s*:\s*\{"count"\s*:\s*(\d+)/i,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  const metaDescription =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description");

  if (metaDescription) {
    const followerMatch = metaDescription.match(
      /([\d.,]+(?:[KMB])?)\s+Followers/i
    );
    if (followerMatch?.[1]) {
      return parseInstagramCountText(followerMatch[1]);
    }
  }

  return null;
}

export function extractInstagramRecentVideoUrlsFromHtml(
  html: string,
  limit = 12
) {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (url: string) => {
    const normalized = extractNormalizedInstagramUrls([url])[0];
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    urls.push(normalized);
  };

  const videoPostMatches = html.matchAll(
    /"shortcode":"([^"]+)","is_video":(true|false)/g
  );
  for (const match of videoPostMatches) {
    if (match[2] !== "true") {
      continue;
    }

    addUrl(`/p/${match[1]}/`);
    if (urls.length >= limit) return urls;
  }

  const reelMatches = html.matchAll(
    /(?:href=["']|https?:\/\/www\.instagram\.com\/)\/?reel\/([^"'/?#\\]+)\/?/gi
  );
  for (const match of reelMatches) {
    addUrl(`/reel/${match[1]}/`);
    if (urls.length >= limit) return urls;
  }

  return urls;
}

export function extractInstagramViewCountFromHtml(html: string) {
  const jsonPatterns = [
    /"video_view_count"\s*:\s*(\d+)/i,
    /"play_count"\s*:\s*(\d+)/i,
    /"view_count"\s*:\s*(\d+)/i,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  const metaDescription =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description");

  if (metaDescription) {
    const viewsMatch = metaDescription.match(/([\d.,]+(?:[KMB])?)\s+(?:Views|Plays)/i);
    if (viewsMatch?.[1]) {
      return parseInstagramCountText(viewsMatch[1]);
    }
  }

  return null;
}

export function isInstagramProfileBlocked(html: string) {
  return /login|accounts\/login|challenge|Please wait a few minutes/i.test(
    html
  );
}

export function isInstagramProfileMissing(html: string) {
  return /Sorry, this page isn't available|The link you followed may be broken|page isn't available/i.test(
    html
  );
}
