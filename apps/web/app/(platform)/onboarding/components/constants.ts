import {
  FlaskConical,
  Link2,
  WandSparkles,
} from "lucide-react";

export const ONBOARDING_STEPS = [
  "brand",
  "discovery",
  "connect",
  "preset",
  "done",
] as const;

export const BRAND_ENTRY_PILLARS = [
  {
    step: "1",
    title: "Ingest the site",
    description:
      "Scrape the homepage, capture metadata, and pull the strongest on-page signals.",
    icon: Link2,
  },
  {
    step: "2",
    title: "Shape the DNA",
    description:
      "Turn raw site evidence into a typed Business DNA with GPT-5-mini.",
    icon: FlaskConical,
  },
  {
    step: "3",
    title: "Guide discovery",
    description:
      "Hand step 2 a cleaner audience, tone, keywords, and visual direction.",
    icon: WandSparkles,
  },
] as const;

export const BRAND_ANALYSIS_STEPS = [
  {
    label: "Opening the homepage",
    detail:
      "Reading the submitted URL and validating the page structure.",
  },
  {
    label: "Capturing metadata",
    detail:
      "Collecting titles, descriptions, open graph fields, and social previews.",
  },
  {
    label: "Pulling the hero story",
    detail:
      "Extracting the strongest headings and visible copy blocks.",
  },
  {
    label: "Curating image candidates",
    detail:
      "Keeping the most usable hero visuals and filtering junk assets.",
  },
  {
    label: "Tracing offer language",
    detail:
      "Finding the product, proof, and positioning signals worth keeping.",
  },
  {
    label: "Mapping the audience",
    detail:
      "Distilling who the brand is for and how it wants to be perceived.",
  },
  {
    label: "Resolving voice and tone",
    detail:
      "Turning copy patterns into a usable creator-facing voice reference.",
  },
  {
    label: "Generating discovery keywords",
    detail:
      "Creating supported keyword hints the next step can act on.",
  },
  {
    label: "Composing the Business DNA",
    detail:
      "Assembling the structured brief from the evidence instead of prose alone.",
  },
  {
    label: "Preparing your reveal",
    detail:
      "Packaging the strongest signals into a reviewable editorial summary.",
  },
] as const;

export type OnboardingAnalysisStatus =
  | "complete"
  | "partial"
  | "failed"
  | "skipped";

export type BrandCreationResponse = {
  brandId: string;
  slug: string;
  brandProfile: import("@/lib/brands/profile").BrandProfileSnapshot | null;
  analysisStatus: OnboardingAnalysisStatus;
  analysisNote: string | null;
};

export function getStepIndex(step: string) {
  const index = ONBOARDING_STEPS.indexOf(
    step as (typeof ONBOARDING_STEPS)[number]
  );

  return index === -1 ? 0 : index;
}

export function parsePositiveInteger(value: string) {
  if (!value.trim()) {
    return { value: null, error: "Daily creator target is required." };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      value: null,
      error: "Daily creator target must be a positive integer.",
    };
  }

  return { value: parsed, error: null };
}

export function buildOnboardingParams(
  step: (typeof ONBOARDING_STEPS)[number],
  values: { brandName?: string; brandId?: string }
) {
  const params = new URLSearchParams({ step });

  if (values.brandName?.trim()) {
    params.set("brandName", values.brandName.trim());
  }

  if (values.brandId?.trim()) {
    params.set("brandId", values.brandId.trim());
  }

  return params.toString();
}

export function formatKeywordsDraft(value: string[] | undefined) {
  return value?.join(", ") ?? "";
}

export function parseKeywordsDraft(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

export function collectProfileImages(
  profile: import("@/lib/brands/profile").BrandProfileSnapshot | null
) {
  if (!profile) {
    return [];
  }

  return Array.from(
    new Set(
      [
        ...(profile.imageCandidates ?? []),
        ...(profile.heroImageCandidates ?? []),
        profile.ogImage,
        profile.twitterImage,
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );
}
