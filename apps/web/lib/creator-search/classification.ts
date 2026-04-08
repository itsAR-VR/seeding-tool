import {
  CANONICAL_DISCOVERY_CATEGORIES,
  type CanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";

export type SecondaryCategory = {
  category: CanonicalDiscoveryCategory;
  confidence: "high" | "medium" | "low";
};

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
  secondaryCategories?: SecondaryCategory[];
};

const CLASSIFICATION_RULES: Array<{
  category: Exclude<CanonicalDiscoveryCategory, "Other">;
  keywords: string[];
}> = [
  {
    category: "Automotive",
    keywords: [
      "automotive",
      "cars",
      "vehicle",
      "truck",
      "motor",
      "driving",
      "mechanic",
      "detailing",
      "coche",
      "voiture",
    ],
  },
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
    category: "Education",
    keywords: [
      "education",
      "teacher",
      "learning",
      "tutorial",
      "tutor",
      "classroom",
      "curriculum",
      "lecture",
      "student",
      "educacion",
      "enseignement",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "entertainment",
      "movie",
      "movies",
      "music",
      "shows",
      "comedy",
      "actor",
      "actress",
      "singer",
      "comedian",
      "performer",
      "concert",
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
  {
    category: "Finance",
    keywords: [
      "finance",
      "investing",
      "investment",
      "crypto",
      "stock",
      "stocks",
      "trading",
      "budget",
      "fintech",
      "wealth",
      "finanzas",
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
      "trainer",
      "entrenamiento",
      "deporte",
      "entrainement",
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
    category: "Gaming",
    keywords: [
      "gaming",
      "gamer",
      "esports",
      "streamer",
      "console",
      "twitch",
      "playstation",
      "xbox",
      "nintendo",
      "videojuegos",
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
    category: "Parenting",
    keywords: [
      "parenting",
      "parent",
      "mom",
      "dad",
      "baby",
      "toddler",
      "motherhood",
      "fatherhood",
      "family",
      "newborn",
      "mama",
      "maternidad",
    ],
  },
  {
    category: "Pets",
    keywords: [
      "pets",
      "pet",
      "dog",
      "cat",
      "puppy",
      "kitten",
      "animal",
      "rescue",
      "veterinary",
      "mascota",
      "animaux",
    ],
  },
  {
    category: "Sports",
    keywords: [
      "sports",
      "athlete",
      "league",
      "football",
      "basketball",
      "soccer",
      "baseball",
      "tennis",
      "marathon",
      "team",
      "championship",
    ],
  },
  {
    category: "Tech",
    keywords: [
      "tech",
      "software",
      "developer",
      "startup",
      "programming",
      "coding",
      "saas",
      "gadget",
      "gadgets",
      "tecnologia",
    ],
  },
  {
    category: "Travel",
    keywords: [
      "travel",
      "traveler",
      "wanderlust",
      "backpacking",
      "destination",
      "tourism",
      "voyage",
      "viaje",
      "explore",
      "nomad",
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
  // Beauty
  ["skin care", "Beauty"],
  ["skincare", "Beauty"],
  ["cosmetics", "Beauty"],
  // Health & Wellness
  ["health and wellness", "Health & Wellness"],
  ["wellness", "Health & Wellness"],
  ["supplement", "Health & Wellness"],
  ["supplements", "Health & Wellness"],
  ["vitamins", "Health & Wellness"],
  // Home & Garden
  ["home decor", "Home & Garden"],
  // Food & Drink
  ["food and beverage", "Food & Drink"],
  // Tech
  ["technology", "Tech"],
  ["software", "Tech"],
  // Gaming
  ["video games", "Gaming"],
  ["esports", "Gaming"],
  // Travel
  ["tourism", "Travel"],
  ["adventure", "Travel"],
  // Parenting
  ["motherhood", "Parenting"],
  ["fatherhood", "Parenting"],
  ["family", "Parenting"],
  // Pets
  ["animals", "Pets"],
  ["pet care", "Pets"],
  // Sports
  ["athletics", "Sports"],
  // Education
  ["learning", "Education"],
  ["tutoring", "Education"],
  // Entertainment
  ["movies", "Entertainment"],
  ["comedy", "Entertainment"],
  // Finance
  ["investing", "Finance"],
  ["personal finance", "Finance"],
  // Automotive
  ["cars", "Automotive"],
  ["vehicles", "Automotive"],
]);

type KeywordMatch = Omit<DiscoveryClassification, "secondaryCategories">;

function collectKeywordMatches(
  normalizedHaystack: string,
  rawSourceCategory: string | null,
  languageDetected: string | null,
): KeywordMatch[] {
  const matches: Array<{ match: KeywordMatch; hitCount: number }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      normalizedHaystack.includes(normalizeLookupValue(keyword))
    );

    if (matchedKeywords.length === 0) {
      continue;
    }

    matches.push({
      match: {
        canonicalCategory: rule.category,
        rawSourceCategory,
        confidence: matchedKeywords.length >= 2 ? "high" : "medium",
        matchedKeywords,
        expandedCategories: matchedKeywords,
        languageDetected,
        topicSignals: matchedKeywords.map((keyword) => ({
          topic: keyword,
          source: "bio" as const,
          strength: matchedKeywords.length >= 2 ? 1 : 0.7,
        })),
      },
      hitCount: matchedKeywords.length,
    });
  }

  return matches
    .sort((a, b) => b.hitCount - a.hitCount)
    .map((entry) => entry.match);
}

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

  const allMatches = collectKeywordMatches(
    normalizedHaystack,
    input.rawSourceCategory ?? null,
    languageDetected,
  );

  if (allMatches.length === 0) {
    return {
      canonicalCategory: "Other",
      rawSourceCategory: input.rawSourceCategory ?? null,
      confidence: "low",
      matchedKeywords: [],
      expandedCategories: [],
      languageDetected,
      topicSignals: [],
    };
  }

  const [primary, ...rest] = allMatches;
  const secondaryCategories: SecondaryCategory[] = rest.map((match) => ({
    category: match.canonicalCategory,
    confidence: match.confidence,
  }));

  return {
    ...primary,
    ...(secondaryCategories.length > 0 ? { secondaryCategories } : {}),
  };
}
