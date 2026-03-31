import {
  CANONICAL_DISCOVERY_CATEGORIES,
  type CanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";

export type DiscoveryClassification = {
  canonicalCategory: CanonicalDiscoveryCategory;
  rawSourceCategory: string | null;
  confidence: "high" | "medium" | "low";
  matchedKeywords: string[];
  expandedCategories: string[];
  languageDetected: string | null;
  topicSignals: Array<{
    topic: string;
    source: "bio" | "caption" | "hashtag" | "category";
    strength: number;
  }>;
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
      "beaute",
      "belleza",
      "maquillaje",
      "maquillage",
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
      "entrenamiento",
      "deporte",
      "entrainement",
    ],
  },
  {
    category: "Health & Wellness",
    keywords: [
      "wellness",
      "supplement",
      "supplements",
      "sleep",
      "vitamin",
      "vitamins",
      "holistic",
      "self-care",
      "self care",
      "gut health",
      "functional medicine",
      "hormone health",
      "bien etre",
      "bienestar",
      "salud",
      "sante",
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
      "receta",
      "recette",
      "cocina",
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
      "hogar",
      "maison",
      "deco",
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
      "moda",
      "mode",
      "ropa",
    ],
  },
];

function normalizeLookupValue(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

const CATEGORY_LOOKUP = new Map(
  CANONICAL_DISCOVERY_CATEGORIES.map((value) => [normalizeLookupValue(value), value])
);

const CATEGORY_ALIASES = new Map<string, CanonicalDiscoveryCategory>([
  ["skin care", "Beauty"],
  ["skincare", "Beauty"],
  ["cosmetics", "Beauty"],
  ["health and wellness", "Health & Wellness"],
  ["wellness", "Health & Wellness"],
  ["supplement", "Health & Wellness"],
  ["supplements", "Health & Wellness"],
  ["vitamins", "Health & Wellness"],
  ["home decor", "Home & Garden"],
  ["food and beverage", "Food & Drink"],
]);

export function classifyDiscoveryText(input: {
  rawSourceCategory?: string | null;
  bio?: string | null;
  name?: string | null;
  profileDump?: string | null;
}): DiscoveryClassification {
  const haystack = [
    input.rawSourceCategory,
    input.bio,
    input.name,
    input.profileDump,
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedHaystack = normalizeLookupValue(haystack);
  const languageDetected =
    /[àâçéèêëîïôûùüÿñæœ]/i.test(haystack)
      ? "fr"
      : /[áéíóúñ¿¡]/i.test(haystack)
        ? "es"
        : /[ãõç]/i.test(haystack)
          ? "pt"
          : /\b(maquillaje|belleza|bienestar|salud|receta|cocina|entrenamiento)\b/.test(normalizedHaystack)
            ? "es"
            : /\b(maquillage|beaute|bien etre|sante|recette|maison|entrainement)\b/.test(normalizedHaystack)
              ? "fr"
              : /\b(beleza|bem estar|saude|receita)\b/.test(normalizedHaystack)
                ? "pt"
          : null;
  const normalizedRawCategory = normalizeLookupValue(input.rawSourceCategory);
  const directCategory = normalizedRawCategory
    ? CATEGORY_LOOKUP.get(normalizedRawCategory) ??
      CATEGORY_ALIASES.get(normalizedRawCategory)
    : undefined;

  if (directCategory) {
    return {
      canonicalCategory: directCategory,
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: "high",
      matchedKeywords: [input.rawSourceCategory ?? directCategory],
      expandedCategories: [input.rawSourceCategory ?? directCategory],
      languageDetected,
      topicSignals: [
        {
          topic: normalizedRawCategory,
          source: "category",
          strength: 1,
        },
      ],
    };
  }

  let bestMatch: DiscoveryClassification | null = null;

  for (const rule of CLASSIFICATION_RULES) {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      normalizedHaystack.includes(normalizeLookupValue(keyword))
    );

    if (matchedKeywords.length === 0) {
      continue;
    }

    const candidate: DiscoveryClassification = {
      canonicalCategory: rule.category,
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: matchedKeywords.length >= 2 ? "high" : "medium",
      matchedKeywords,
      expandedCategories: matchedKeywords,
      languageDetected,
      topicSignals: matchedKeywords.map((keyword) => ({
        topic: keyword,
        source: "bio",
        strength: matchedKeywords.length >= 2 ? 1 : 0.7,
      })),
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
      expandedCategories: [],
      languageDetected,
      topicSignals: [],
    }
  );
}
