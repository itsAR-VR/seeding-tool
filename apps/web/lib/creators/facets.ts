export type FacetOption = {
  value: string;
  count: number;
};

export type CreatorFacets = {
  categories: FacetOption[];
  keywords: FacetOption[];
  hashtags: FacetOption[];
  usernames: FacetOption[];
  locations: FacetOption[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "beauty",
  "best",
  "brand",
  "care",
  "content",
  "creator",
  "daily",
  "email",
  "fashion",
  "fitness",
  "for",
  "from",
  "health",
  "here",
  "instagram",
  "just",
  "lifestyle",
  "love",
  "make",
  "more",
  "official",
  "real",
  "shop",
  "that",
  "the",
  "their",
  "this",
  "tips",
  "wellness",
  "with",
  "your",
]);

function incrementCount(
  counts: Map<string, number>,
  value: string | null | undefined
) {
  const normalized = value?.trim();
  if (!normalized) return;

  counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
}

function readJsonString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entry = (value as Record<string, unknown>)[key];
  return typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null;
}

function tokenizeKeywords(value: string | null | undefined) {
  if (!value) return [];

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !/^\d+$/.test(token) &&
        !STOP_WORDS.has(token)
    );
}

function sortFacetEntries(counts: Map<string, number>, limit: number) {
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export type CreatorFacetRow = {
  bio: string | null;
  bioCategory: string | null;
  instagramHandle: string | null;
  discoveryTouches: Array<{
    metadata: unknown;
  }>;
};

export function buildCreatorFacets(creators: CreatorFacetRow[]): CreatorFacets {
  const categoryCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();
  const usernameCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();

  for (const creator of creators) {
    incrementCount(categoryCounts, creator.bioCategory);

    const handle = creator.instagramHandle?.trim().replace(/^@/, "") || null;
    incrementCount(usernameCounts, handle);

    const creatorKeywords = new Set<string>([
      ...tokenizeKeywords(creator.bioCategory),
      ...tokenizeKeywords(creator.bio),
    ]);

    for (const keyword of creatorKeywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }

    const creatorLocations = new Set<string>();
    for (const touch of creator.discoveryTouches) {
      const location = readJsonString(touch.metadata, "location");
      if (location) {
        creatorLocations.add(location);
      }
    }

    for (const location of creatorLocations) {
      incrementCount(locationCounts, location);
    }
  }

  const keywords = sortFacetEntries(keywordCounts, 24);
  const categories = sortFacetEntries(categoryCounts, 20);
  const usernames = sortFacetEntries(usernameCounts, 40);
  const locations = sortFacetEntries(locationCounts, 24);
  const hashtags = keywords
    .slice(0, 20)
    .map(({ value, count }) => ({ value: `#${value}`, count }));

  return {
    categories,
    keywords,
    hashtags,
    usernames,
    locations,
  };
}
