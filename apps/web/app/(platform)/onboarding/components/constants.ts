import type { BrandProfileSnapshot } from "@/lib/brands/profile";

export const ONBOARDING_STEPS = ["brand", "kit", "connect"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  brand: "Your brand",
  kit: "Gift and replies",
  connect: "Accounts",
};

/** Shown one after another while the website is read (takes up to a minute). */
export const READING_MESSAGES = [
  "Opening your website",
  "Reading what you sell and who it's for",
  "Picking words to find creators with",
  "Almost done",
] as const;

export type OnboardingAnalysisStatus = "complete" | "partial" | "failed" | "skipped";

export type BrandCreationResponse = {
  brandId: string;
  slug: string;
  brandProfile: BrandProfileSnapshot | null;
  analysisStatus: OnboardingAnalysisStatus;
  analysisNote: string | null;
};

/** Old links (discovery, preset, done) land on the closest current step. */
export function normalizeStep(step: string | null): OnboardingStep {
  if (step === "kit" || step === "connect") return step;
  if (step === "discovery") return "kit";
  if (step === "preset" || step === "done") return "connect";
  return "brand";
}

export function buildOnboardingParams(step: OnboardingStep, values: { brandName?: string; brandId?: string }) {
  const params = new URLSearchParams({ step });
  if (values.brandName?.trim()) params.set("brandName", values.brandName.trim());
  if (values.brandId?.trim()) params.set("brandId", values.brandId.trim());
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
        .filter(Boolean),
    ),
  );
}

/** A starting point for the product facts, built from what the website said. */
export function starterProductFacts(profile: BrandProfileSnapshot | null, websiteUrl: string): string {
  const lines: string[] = [];
  const product = profile?.keyProducts?.[0];
  lines.push(
    product
      ? `- The gift is ${product}. It's free, and shipping is on us.`
      : "- The gift is [your product]. It's free, and shipping is on us.",
  );
  lines.push("- How to use it: [one line]");
  const domain = websiteUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (domain) lines.push(`- Website: ${domain}`);
  return lines.join("\n");
}
