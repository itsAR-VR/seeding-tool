import {
  CANONICAL_DISCOVERY_CATEGORIES,
  type CanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";

export type DiscoveryClassification = {
  canonicalCategory: CanonicalDiscoveryCategory;
  rawSourceCategory: string | null;
  confidence: "high" | "medium" | "low";
  matchedKeywords: string[];
};

const CLASSIFICATION_RULES: Array<{
  category: Exclude<CanonicalDiscoveryCategory, "Other">;
  keywords: string[];
}> = [
  {
    category: "Beauty",
    keywords: [
      "beauty",
      "skincare",
      "makeup",
      "cosmetic",
      "haircare",
      "esthetician",
    ],
  },
  {
    category: "Fitness & Workout",
    keywords: [
      "fitness",
      "workout",
      "gym",
      "exercise",
      "yoga",
      "pilates",
      "athlete",
      "trainer",
      "wellness",
    ],
  },
  {
    category: "Food & Drink",
    keywords: [
      "food",
      "drink",
      "recipe",
      "cook",
      "chef",
      "baking",
      "restaurant",
      "nutrition",
      "beverage",
    ],
  },
  {
    category: "Home & Garden",
    keywords: [
      "home",
      "garden",
      "decor",
      "interior",
      "diy",
      "cleaning",
      "organization",
      "house",
    ],
  },
  {
    category: "Fashion",
    keywords: [
      "fashion",
      "style",
      "outfit",
      "clothing",
      "apparel",
      "wardrobe",
      "streetwear",
    ],
  },
];

const CATEGORY_LOOKUP = new Map(
  CANONICAL_DISCOVERY_CATEGORIES.map((value) => [value.toLowerCase(), value])
);

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function classifyDiscoveryText(input: {
  rawSourceCategory?: string | null;
  bio?: string | null;
  name?: string | null;
  profileDump?: string | null;
}): DiscoveryClassification {
  const normalizedRawCategory = normalizeText(input.rawSourceCategory);
  const directCategory = normalizedRawCategory
    ? CATEGORY_LOOKUP.get(normalizedRawCategory)
    : undefined;

  if (directCategory) {
    return {
      canonicalCategory: directCategory,
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: "high",
      matchedKeywords: [input.rawSourceCategory ?? directCategory],
    };
  }

  const haystack = [
    input.rawSourceCategory,
    input.bio,
    input.name,
    input.profileDump,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let bestMatch: DiscoveryClassification | null = null;

  for (const rule of CLASSIFICATION_RULES) {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      haystack.includes(keyword)
    );

    if (matchedKeywords.length === 0) {
      continue;
    }

    const candidate: DiscoveryClassification = {
      canonicalCategory: rule.category,
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: matchedKeywords.length >= 2 ? "high" : "medium",
      matchedKeywords,
    };

    if (
      !bestMatch ||
      matchedKeywords.length > bestMatch.matchedKeywords.length
    ) {
      bestMatch = candidate;
    }
  }

  return (
    bestMatch ?? {
      canonicalCategory: "Other",
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: "low",
      matchedKeywords: [],
    }
  );
}
