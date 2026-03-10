import type { CategorySelection } from "@/components/grouped-category-picker";
import type { BrandProfileSnapshot } from "@/lib/brands/profile";

type SuggestionRule = {
  label: string;
  keywords: string[];
  source: keyof CategorySelection;
};

const SUGGESTION_RULES: SuggestionRule[] = [
  { label: "Beauty", source: "apify", keywords: ["beauty", "makeup", "cosmetic", "haircare"] },
  { label: "Fitness & Workout", source: "apify", keywords: ["fitness", "workout", "gym", "trainer", "pilates", "yoga"] },
  { label: "Food & Drink", source: "apify", keywords: ["food", "drink", "recipe", "chef", "nutrition", "beverage"] },
  { label: "Home & Garden", source: "apify", keywords: ["home", "garden", "interior", "decor", "organization"] },
  { label: "Fashion", source: "apify", keywords: ["fashion", "style", "outfit", "apparel", "clothing"] },
  { label: "Lifestyle", source: "collabstr", keywords: ["lifestyle", "routine", "daily life"] },
  { label: "Health & Wellness", source: "collabstr", keywords: ["wellness", "health", "sleep", "recovery", "mindfulness", "self-care"] },
  { label: "Skincare", source: "collabstr", keywords: ["skincare", "skin", "serum", "moisturizer", "spf"] },
  { label: "Supplements", source: "collabstr", keywords: ["supplement", "vitamin", "capsule", "gummy", "collagen"] },
  { label: "Travel", source: "collabstr", keywords: ["travel", "hotel", "trip", "vacation", "luggage"] },
  { label: "Home Decor", source: "collabstr", keywords: ["home decor", "interior", "bedding", "furniture", "room"] },
  { label: "Food & Beverage", source: "collabstr", keywords: ["beverage", "coffee", "tea", "snack", "meal"] },
  { label: "Parenting", source: "collabstr", keywords: ["parenting", "mom", "baby", "kids", "family"] },
  { label: "Pets", source: "collabstr", keywords: ["pet", "dog", "cat", "puppy", "feline"] },
  { label: "Sustainable Living", source: "collabstr", keywords: ["sustainable", "eco", "compostable", "low waste", "plastic-free"] },
  { label: "Tech", source: "collabstr", keywords: ["tech", "software", "app", "device", "gadget", "platform"] },
  { label: "Outdoor & Adventure", source: "collabstr", keywords: ["outdoor", "adventure", "camping", "hiking", "trail"] },
];

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildProfileHaystack(profile: BrandProfileSnapshot | null) {
  if (!profile) return "";

  return [
    profile.title,
    profile.description,
    profile.siteName,
    profile.ogTitle,
    profile.ogDescription,
    profile.twitterTitle,
    profile.twitterDescription,
    profile.bodyExcerpt,
    ...profile.heroHeadings,
    ...profile.textSignals,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export type SuggestedCategoryResult = {
  selection: CategorySelection;
  matchedLabels: string[];
};

export function suggestCategorySelectionFromBrandProfile(
  profile: BrandProfileSnapshot | null
): SuggestedCategoryResult {
  const haystack = buildProfileHaystack(profile);
  const apify = new Set<string>();
  const collabstr = new Set<string>();
  const matchedLabels: string[] = [];

  if (!haystack) {
    return {
      selection: { apify: [], collabstr: [] },
      matchedLabels: [],
    };
  }

  for (const rule of SUGGESTION_RULES) {
    const matched = rule.keywords.some((keyword) =>
      haystack.includes(normalizeText(keyword))
    );

    if (!matched) {
      continue;
    }

    matchedLabels.push(rule.label);
    if (rule.source === "apify") {
      apify.add(rule.label);
    } else {
      collabstr.add(rule.label);
    }
  }

  return {
    selection: {
      apify: Array.from(apify),
      collabstr: Array.from(collabstr),
    },
    matchedLabels: Array.from(new Set(matchedLabels)),
  };
}
