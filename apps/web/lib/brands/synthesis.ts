import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { BrandBusinessDna, BrandProfileSnapshot } from "@/lib/brands/profile";
import { listBrandImageCandidates } from "@/lib/brands/profile";

const BUSINESS_DNA_MODEL = "gpt-4.1-mini";
const BUSINESS_DNA_TIMEOUT_MS = 35_000;
const BUSINESS_DNA_MAX_COMPLETION_TOKENS = 1800;

const BusinessDnaResponseSchema = z.object({
  brandSummary: z.string().nullable(),
  targetAudience: z.string().nullable(),
  niche: z.string().nullable(),
  category: z.string().nullable(),
  tone: z.string().nullable(),
  brandVoice: z.string().nullable(),
  keyProducts: z.array(z.string()),
  proofSignals: z.array(z.string()),
  keywords: z.array(z.string()),
  visualDirection: z.array(z.string()),
  imageCandidates: z.array(z.string()),
});

type ParsedBusinessDna = z.infer<typeof BusinessDnaResponseSchema>;

type ParsedCompletion = {
  choices?: Array<{
    message?: {
      parsed?: ParsedBusinessDna | null;
    };
  }>;
};

export type BusinessDnaClient = {
  chat: {
    completions: {
      parse: (...args: unknown[]) => Promise<ParsedCompletion>;
    };
  };
};

export type BusinessDnaEdits = {
  brandSummary?: string | null;
  targetAudience?: string | null;
  brandVoice?: string | null;
  tone?: string | null;
  keywords?: string[];
};

let cachedClient: OpenAI | null | undefined;

export function getBusinessDnaModel() {
  return BUSINESS_DNA_MODEL;
}

export async function synthesizeBusinessDna(
  input: {
    brandName: string;
    websiteUrl: string;
    profile: BrandProfileSnapshot;
  },
  client: BusinessDnaClient | null = getDefaultBusinessDnaClient()
): Promise<BrandBusinessDna | null> {
  if (!client) {
    return null;
  }

  try {
    const completion = await client.chat.completions.parse(
      {
        model: BUSINESS_DNA_MODEL,
        max_completion_tokens: BUSINESS_DNA_MAX_COMPLETION_TOKENS,
        messages: [
          {
            role: "system",
            content:
              "You are a brand strategist extracting structured Business DNA from a website scrape. Use only the supplied evidence. If a field is unclear, return null for strings and [] for arrays. Do not invent claims, products, or audiences beyond the provided data. Keep every string concise, avoid repetition, and keep arrays tight.",
          },
          {
            role: "user",
            content: buildBrandAnalysisPrompt(input),
          },
        ],
        response_format: zodResponseFormat(
          BusinessDnaResponseSchema,
          "brand_business_dna"
        ),
      },
      { signal: AbortSignal.timeout(BUSINESS_DNA_TIMEOUT_MS) }
    );

    const parsed = completion.choices?.[0]?.message?.parsed;
    if (!parsed) {
      return null;
    }

    return normalizeBusinessDna(parsed, input.profile);
  } catch (error) {
    console.warn("[brands/synthesis] Business DNA synthesis failed", {
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      model: BUSINESS_DNA_MODEL,
      timeoutMs: BUSINESS_DNA_TIMEOUT_MS,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function mergeBrandProfileWithBusinessDna(
  profile: BrandProfileSnapshot,
  options: {
    businessDna?: BrandBusinessDna | null;
    status: BrandProfileSnapshot["analysisStatus"];
    model?: string | null;
    note?: string | null;
    analyzedAt?: string;
  }
): BrandProfileSnapshot {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();

  if (!options.businessDna) {
    return {
      ...profile,
      businessDna: null,
      analysisStatus: options.status,
      analysisModel: options.model ?? null,
      analyzedAt,
      analysisNote: options.note ?? null,
      imageCandidates: listBrandImageCandidates(profile),
    };
  }

  return {
    ...profile,
    ...options.businessDna,
    businessDna: options.businessDna,
    analysisStatus: options.status,
    analysisModel: options.model ?? BUSINESS_DNA_MODEL,
    analyzedAt,
    analysisNote: options.note ?? null,
  };
}

export function applyBusinessDnaEdits(
  profile: BrandProfileSnapshot | null,
  edits: BusinessDnaEdits
): BrandProfileSnapshot {
  const baseProfile = profile ?? createEmptyBrandProfile();
  const existingBusinessDna = baseProfile.businessDna ?? {
    brandSummary: baseProfile.brandSummary ?? null,
    targetAudience: baseProfile.targetAudience ?? baseProfile.audience ?? null,
    audience: baseProfile.audience ?? baseProfile.targetAudience ?? null,
    niche: baseProfile.niche ?? null,
    category: baseProfile.category ?? null,
    industry: baseProfile.industry ?? baseProfile.category ?? null,
    tone: baseProfile.tone ?? baseProfile.brandVoice ?? null,
    brandVoice: baseProfile.brandVoice ?? baseProfile.tone ?? null,
    keyProducts: baseProfile.keyProducts ?? [],
    proofSignals: baseProfile.proofSignals ?? [],
    keywords: baseProfile.keywords ?? [],
    visualDirection: baseProfile.visualDirection ?? [],
    imageCandidates:
      baseProfile.imageCandidates ?? listBrandImageCandidates(baseProfile),
  };

  const brandSummary = resolveEditedString(
    edits.brandSummary,
    baseProfile.brandSummary ?? existingBusinessDna.brandSummary
  );
  const targetAudience = resolveEditedString(
    edits.targetAudience,
    baseProfile.targetAudience ??
      baseProfile.audience ??
      existingBusinessDna.targetAudience ??
      existingBusinessDna.audience
  );
  const voiceValue = resolveEditedString(
    edits.brandVoice ?? edits.tone,
    baseProfile.brandVoice ??
      baseProfile.tone ??
      existingBusinessDna.brandVoice ??
      existingBusinessDna.tone
  );
  const keywords =
    edits.keywords !== undefined
      ? dedupeStrings(edits.keywords).slice(0, 12)
      : dedupeStrings(
          baseProfile.keywords?.length
            ? baseProfile.keywords
            : existingBusinessDna.keywords
        ).slice(0, 12);
  const imageCandidates = dedupeStrings(
    baseProfile.imageCandidates?.length
      ? baseProfile.imageCandidates
      : existingBusinessDna.imageCandidates.length
        ? existingBusinessDna.imageCandidates
        : listBrandImageCandidates(baseProfile)
  ).slice(0, 5);

  return {
    ...baseProfile,
    businessDna: {
      ...existingBusinessDna,
      brandSummary,
      targetAudience,
      audience: targetAudience,
      tone: voiceValue,
      brandVoice: voiceValue,
      keywords,
      imageCandidates,
    },
    analysisStatus: baseProfile.analysisStatus ?? "partial",
    analysisNote:
      baseProfile.analysisNote ??
      "Business DNA was reviewed and refined during onboarding.",
    brandSummary,
    targetAudience,
    audience: targetAudience,
    tone: voiceValue,
    brandVoice: voiceValue,
    keywords,
    imageCandidates,
  };
}

export function normalizeBusinessDna(
  value: ParsedBusinessDna,
  profile: BrandProfileSnapshot
): BrandBusinessDna {
  const fallbackImages = listBrandImageCandidates(profile);
  const allowedImages = new Set(fallbackImages);
  const selectedImages = dedupeStrings(value.imageCandidates)
    .filter((candidate) => allowedImages.has(candidate))
    .slice(0, 5);

  const targetAudience = cleanNullableString(value.targetAudience);
  const niche =
    cleanNullableString(value.niche) ?? cleanNullableString(value.category);
  const category =
    cleanNullableString(value.category) ?? cleanNullableString(value.niche);
  const tone =
    cleanNullableString(value.tone) ?? cleanNullableString(value.brandVoice);
  const brandVoice =
    cleanNullableString(value.brandVoice) ?? cleanNullableString(value.tone);

  return {
    brandSummary: cleanNullableString(value.brandSummary),
    targetAudience,
    audience: targetAudience,
    niche,
    category,
    industry: category,
    tone,
    brandVoice,
    keyProducts: dedupeStrings(value.keyProducts).slice(0, 6),
    proofSignals: dedupeStrings(value.proofSignals).slice(0, 6),
    keywords: dedupeStrings(value.keywords).slice(0, 12),
    visualDirection: dedupeStrings(value.visualDirection).slice(0, 6),
    imageCandidates:
      selectedImages.length > 0 ? selectedImages : fallbackImages.slice(0, 5),
  };
}

function buildBrandAnalysisPrompt(input: {
  brandName: string;
  websiteUrl: string;
  profile: BrandProfileSnapshot;
}) {
  const imageCandidates = listBrandImageCandidates(input.profile);

  return [
    `Brand name: ${input.brandName}`,
    `Website: ${input.websiteUrl}`,
    `Domain: ${input.profile.domain}`,
    `Title: ${input.profile.title ?? "(none)"}`,
    `Description: ${input.profile.description ?? "(none)"}`,
    `Site name: ${input.profile.siteName ?? "(none)"}`,
    `Open Graph title: ${input.profile.ogTitle ?? "(none)"}`,
    `Open Graph description: ${input.profile.ogDescription ?? "(none)"}`,
    `Twitter title: ${input.profile.twitterTitle ?? "(none)"}`,
    `Twitter description: ${input.profile.twitterDescription ?? "(none)"}`,
    `Hero headings:\n${toBulletList(input.profile.heroHeadings)}`,
    `Text signals:\n${toBulletList(input.profile.textSignals)}`,
    `Body excerpt:\n${input.profile.bodyExcerpt ?? "(none)"}`,
    `Image candidates:\n${toBulletList(imageCandidates.slice(0, 5))}`,
    "",
    "Return structured Business DNA with:",
    "- a concise brandSummary grounded in the site copy",
    "- targetAudience as a plain-language audience description",
    "- niche/category/tone/brandVoice inferred from evidence",
    "- keyProducts as the main offers mentioned on the site",
    "- proofSignals as short facts or claims visible in the site copy",
    "- keywords as creator/discovery phrases directly supported by the site",
    "- visualDirection as 3-6 short descriptors of the visual language",
    "- imageCandidates as exact URLs chosen only from the supplied image list",
    "",
    "Hard limits:",
    "- keep brandSummary under 220 characters",
    "- keep targetAudience under 140 characters",
    "- keep tone and brandVoice under 80 characters each",
    "- keep keyProducts to 4 items max",
    "- keep proofSignals to 5 items max",
    "- keep keywords to 8 items max",
    "- keep visualDirection to 5 items max",
    "- keep imageCandidates to 2 items max",
    "- keep every list item short and plain",
  ].join("\n");
}

function getDefaultBusinessDnaClient(): BusinessDnaClient | null {
  if (cachedClient !== undefined) {
    return cachedClient as BusinessDnaClient | null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  cachedClient = apiKey ? new OpenAI({ apiKey }) : null;
  return cachedClient as BusinessDnaClient | null;
}

function createEmptyBrandProfile(): BrandProfileSnapshot {
  return {
    sourceUrl: "",
    domain: "",
    fetchedAt: new Date().toISOString(),
    title: null,
    description: null,
    siteName: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
    heroHeadings: [],
    heroImageCandidates: [],
    textSignals: [],
    bodyExcerpt: null,
  };
}

function cleanNullableString(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function resolveEditedString(
  incoming: string | null | undefined,
  fallback: string | null | undefined
) {
  if (incoming !== undefined) {
    return cleanNullableString(incoming);
  }

  return cleanNullableString(fallback);
}

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function toBulletList(values: string[]) {
  if (values.length === 0) {
    return "- (none)";
  }

  return values.map((value) => `- ${value}`).join("\n");
}
