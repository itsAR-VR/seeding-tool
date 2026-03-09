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

export function isInstagramProfileBlocked(html: string) {
  return /login|accounts\/login|challenge|Please wait a few minutes/i.test(
    html
  );
}
