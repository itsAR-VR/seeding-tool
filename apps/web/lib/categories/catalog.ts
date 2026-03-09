const COLLABSTR_FALLBACK_CATEGORIES = [
  "Lifestyle",
  "Health & Wellness",
  "Skincare",
  "Supplements",
  "Travel",
  "Home Decor",
  "Food & Beverage",
  "Parenting",
  "Pets",
  "Sustainable Living",
  "Tech",
  "Outdoor & Adventure",
] as const;

function uniqueSorted(values: readonly string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

// Source: docs/n8n-audit-2026-03-01/-AC-1-Instagram-Following-PROD-.json
// Analyze Bio node primary_category prompt on 2026-03-01.
export const APIFY_CATEGORIES = [
  "Beauty",
  "Fitness & Workout",
  "Food & Drink",
  "Home & Garden",
  "Fashion",
] as const;

// The committed repo does not currently include scripts/collabstr-influencers.jsonl,
// so this secondary group stays as a conservative fallback until the dataset is restored.
export const COLLABSTR_CATEGORIES = uniqueSorted(COLLABSTR_FALLBACK_CATEGORIES);

export function getGroupedCategories() {
  return {
    apify: [...APIFY_CATEGORIES],
    collabstr: [...COLLABSTR_CATEGORIES],
  };
}
