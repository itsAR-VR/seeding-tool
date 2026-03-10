import { z } from "zod";
import {
  CANONICAL_DISCOVERY_CATEGORIES,
  isCanonicalDiscoveryCategory,
  type CanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";

export type { CanonicalDiscoveryCategory } from "@/lib/categories/catalog";

export const UNIFIED_DISCOVERY_SOURCES = [
  "collabstr",
  "apify_search",
  "approved_seed_following",
  "apify_keyword_email",
] as const;

export type UnifiedDiscoverySource = typeof UNIFIED_DISCOVERY_SOURCES[number];

export type UnifiedDiscoveryPlatform = "instagram";

export type UnifiedDiscoveryFilters = {
  minFollowers?: number;
  maxFollowers?: number;
  minAvgViews?: number;
  requireCategory: boolean;
  excludeExistingCreators: boolean;
};

export type UnifiedSeedExpansion = {
  enabled: boolean;
  maxSeedsPerRun: number;
  maxFollowingPerSeed: number;
};

export type UnifiedDiscoveryQuery = {
  sources: UnifiedDiscoverySource[];
  keywords: string[];
  canonicalCategories: CanonicalDiscoveryCategory[];
  platform: UnifiedDiscoveryPlatform;
  limit: number;
  location?: string;
  filters: UnifiedDiscoveryFilters;
  seedExpansion: UnifiedSeedExpansion;
  emailPrefetch: boolean;
  usernames: string[];
};

export type LegacyManualCreatorSearchRequest = {
  searchMode?: "hashtag" | "profile";
  hashtag?: string;
  usernames?: string[];
  limit?: number;
  platform?: string;
};

export type LegacyCampaignSearchRequest = {
  platform?: string;
  keywords?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  category?: string;
  location?: string;
  limit?: number;
  sources?: UnifiedDiscoverySource[];
};

export type LegacyAutomationDiscoveryConfig = {
  searchMode?: "hashtag" | "profile";
  hashtag?: string;
  usernames?: string[];
  limit?: number;
  platform?: string;
  categories?: {
    apify?: string[];
    collabstr?: string[];
  };
  query?: unknown;
};

const unifiedDiscoverySourceSchema = z.enum(UNIFIED_DISCOVERY_SOURCES);
const canonicalDiscoveryCategorySchema = z.enum(
  CANONICAL_DISCOVERY_CATEGORIES
);
const canonicalCategoryLookup = new Map(
  CANONICAL_DISCOVERY_CATEGORIES.map((value) => [value.toLowerCase(), value])
);

const positiveInt = z.number().int().positive();

const unifiedDiscoveryFiltersSchema = z.object({
  minFollowers: positiveInt.optional(),
  maxFollowers: positiveInt.optional(),
  minAvgViews: positiveInt.optional(),
  requireCategory: z.boolean().default(false),
  excludeExistingCreators: z.boolean().default(true),
});

const unifiedSeedExpansionSchema = z.object({
  enabled: z.boolean().default(false),
  maxSeedsPerRun: positiveInt.default(5),
  maxFollowingPerSeed: positiveInt.default(100),
});

export const unifiedDiscoveryQuerySchema = z.object({
  sources: z
    .array(unifiedDiscoverySourceSchema)
    .min(1)
    .default(["collabstr", "apify_search"]),
  keywords: z.array(z.string()).default([]),
  canonicalCategories: z.array(canonicalDiscoveryCategorySchema).default([]),
  platform: z.literal("instagram").default("instagram"),
  limit: positiveInt.max(250).default(25),
  location: z.string().trim().min(1).optional(),
  filters: unifiedDiscoveryFiltersSchema.default({
    requireCategory: false,
    excludeExistingCreators: true,
  }),
  seedExpansion: unifiedSeedExpansionSchema.default({
    enabled: false,
    maxSeedsPerRun: 5,
    maxFollowingPerSeed: 100,
  }),
  emailPrefetch: z.boolean().default(false),
  // Backward-compat for the current /creators direct-profile search UI.
  usernames: z.array(z.string()).default([]),
});

function normalizeStringList(values: readonly string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeUsernameList(values: readonly string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().replace(/^@/, ""))
        .filter(Boolean)
    )
  );
}

function normalizePositiveInt(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

function toCanonicalCategories(
  values: readonly string[] | undefined
): CanonicalDiscoveryCategory[] {
  return normalizeStringList(values)
    .map((value) => canonicalCategoryLookup.get(value.toLowerCase()) ?? null)
    .filter((value): value is CanonicalDiscoveryCategory => value !== null);
}

function splitCategorySignals(
  values: readonly string[] | undefined
): {
  canonicalCategories: CanonicalDiscoveryCategory[];
  keywords: string[];
} {
  const canonicalCategories: CanonicalDiscoveryCategory[] = [];
  const keywords: string[] = [];

  for (const value of normalizeStringList(values)) {
    const canonical = canonicalCategoryLookup.get(value.toLowerCase());
    if (canonical && isCanonicalDiscoveryCategory(canonical)) {
      canonicalCategories.push(canonical);
    } else {
      keywords.push(value);
    }
  }

  return {
    canonicalCategories: Array.from(new Set(canonicalCategories)),
    keywords: Array.from(new Set(keywords)),
  };
}

export function normalizeUnifiedDiscoveryQuery(
  query: Partial<UnifiedDiscoveryQuery>
): UnifiedDiscoveryQuery {
  const normalizedSources = query.sources
    ? (normalizeStringList(query.sources) as UnifiedDiscoverySource[])
    : undefined;

  return unifiedDiscoveryQuerySchema.parse({
    ...query,
    ...(normalizedSources ? { sources: normalizedSources } : {}),
    keywords: normalizeStringList(query.keywords),
    canonicalCategories: toCanonicalCategories(query.canonicalCategories),
    limit: normalizePositiveInt(query.limit, 25),
    location: query.location?.trim() || undefined,
    filters: {
      requireCategory: query.filters?.requireCategory ?? false,
      excludeExistingCreators:
        query.filters?.excludeExistingCreators ?? true,
      ...(query.filters?.minFollowers
        ? {
            minFollowers: normalizePositiveInt(
              query.filters.minFollowers,
              query.filters.minFollowers
            ),
          }
        : {}),
      ...(query.filters?.maxFollowers
        ? {
            maxFollowers: normalizePositiveInt(
              query.filters.maxFollowers,
              query.filters.maxFollowers
            ),
          }
        : {}),
      ...(query.filters?.minAvgViews
        ? {
            minAvgViews: normalizePositiveInt(
              query.filters.minAvgViews,
              query.filters.minAvgViews
            ),
          }
        : {}),
    },
    seedExpansion: {
      enabled: query.seedExpansion?.enabled ?? false,
      maxSeedsPerRun: normalizePositiveInt(
        query.seedExpansion?.maxSeedsPerRun,
        5
      ),
      maxFollowingPerSeed: normalizePositiveInt(
        query.seedExpansion?.maxFollowingPerSeed,
        100
      ),
    },
    emailPrefetch: query.emailPrefetch ?? false,
    usernames: normalizeUsernameList(query.usernames),
  });
}

export function buildUnifiedDiscoveryQueryFromManualSearch(
  body: LegacyManualCreatorSearchRequest
): UnifiedDiscoveryQuery {
  const hashtag = body.hashtag?.trim().replace(/^#/, "");

  return normalizeUnifiedDiscoveryQuery({
    sources: ["apify_search"],
    keywords:
      body.searchMode === "hashtag" && hashtag ? [hashtag] : [],
    canonicalCategories: [],
    platform: "instagram",
    limit: normalizePositiveInt(body.limit, 50),
    filters: {
      requireCategory: false,
      excludeExistingCreators: false,
    },
    emailPrefetch: false,
    usernames:
      body.searchMode === "profile" ? normalizeUsernameList(body.usernames) : [],
  });
}

export function buildUnifiedDiscoveryQueryFromCampaignSearch(
  body: LegacyCampaignSearchRequest
): UnifiedDiscoveryQuery {
  const keywordSignals = normalizeStringList(body.keywords);
  const categorySignals = splitCategorySignals(
    body.category ? [body.category] : undefined
  );

  return normalizeUnifiedDiscoveryQuery({
    sources: body.sources?.length ? body.sources : ["collabstr"],
    keywords: [...keywordSignals, ...categorySignals.keywords],
    canonicalCategories: categorySignals.canonicalCategories,
    platform: "instagram",
    limit: normalizePositiveInt(body.limit, 20),
    location: body.location?.trim() || undefined,
    filters: {
      ...(body.minFollowers
        ? { minFollowers: normalizePositiveInt(body.minFollowers, 1) }
        : {}),
      ...(body.maxFollowers
        ? { maxFollowers: normalizePositiveInt(body.maxFollowers, 1) }
        : {}),
      requireCategory: categorySignals.canonicalCategories.length > 0,
      excludeExistingCreators: true,
    },
    emailPrefetch: false,
  });
}

export function buildUnifiedDiscoveryQueryFromAutomationConfig(
  config: LegacyAutomationDiscoveryConfig
): UnifiedDiscoveryQuery {
  if (config.query && typeof config.query === "object") {
    return normalizeUnifiedDiscoveryQuery(
      config.query as Partial<UnifiedDiscoveryQuery>
    );
  }

  const hashtag = config.hashtag?.trim().replace(/^#/, "");
  const apifySignals = splitCategorySignals(config.categories?.apify);
  const collabstrSignals = splitCategorySignals(config.categories?.collabstr);

  return normalizeUnifiedDiscoveryQuery({
    sources: ["apify_search"],
    keywords: [
      ...(hashtag ? [hashtag] : []),
      ...apifySignals.keywords,
      ...collabstrSignals.keywords,
    ],
    canonicalCategories: [
      ...apifySignals.canonicalCategories,
      ...collabstrSignals.canonicalCategories,
    ],
    platform: "instagram",
    limit: normalizePositiveInt(config.limit, 50),
    filters: {
      requireCategory:
        apifySignals.canonicalCategories.length > 0 ||
        collabstrSignals.canonicalCategories.length > 0,
      excludeExistingCreators: true,
    },
    emailPrefetch: false,
    usernames:
      config.searchMode === "profile"
        ? normalizeUsernameList(config.usernames)
        : [],
  });
}
