/**
 * Brand Identity & ICP (Ideal Creator Profile) derivation helpers.
 *
 * Composes a structured context object from:
 *   - Brand.websiteUrl
 *   - BrandSettings.brandProfile (JSON blob set during onboarding)
 *   - Campaign products (CampaignProduct → BrandProduct)
 *
 * Used by the creator-search pipeline to drive Fly worker queries
 * and AI fit-scoring prompts.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────

export type BrandProduct = {
  name: string;
  description?: string | null;
  productUrl?: string | null;
  retailValue?: number | null; // cents
};

export type BrandICP = {
  brandName: string;
  websiteUrl?: string | null;
  /** Raw profile blob from onboarding wizard (arbitrary JSON) */
  brandProfile: Record<string, unknown> | null;
  /** Derived from brandProfile.targetAudience or top-level niche */
  targetAudience?: string | null;
  /** Derived from brandProfile.niche / category */
  niche?: string | null;
  /** Derived from brandProfile.tone / brandVoice */
  brandVoice?: string | null;
  /** Products relevant to the campaign (or all brand products if no campaign) */
  products: BrandProduct[];
  /** Human-readable summary for prompts */
  summary: string;
};

type CampaignProductsSelection = {
  campaignProducts?: Array<{
    product: BrandProduct;
  }>;
};

// ─── Main function ─────────────────────────────────────────────────────────

/**
 * Derive a BrandICP from DB. Pass campaignId to scope products to that campaign.
 * Falls back to all brand products if campaignId is not provided.
 */
export async function deriveBrandICP(
  brandId: string,
  campaignId?: string
): Promise<BrandICP> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      name: true,
      websiteUrl: true,
      settings: {
        select: {
          brandVoice: true,
          brandProfile: true,
        },
      },
      campaigns: campaignId
        ? {
            where: { id: campaignId },
            select: {
              campaignProducts: {
                select: {
                  product: {
                    select: {
                      name: true,
                      description: true,
                      productUrl: true,
                      retailValue: true,
                    },
                  },
                },
              },
            },
          }
        : undefined,
      products: campaignId
        ? undefined
        : {
            select: {
              name: true,
              description: true,
              productUrl: true,
              retailValue: true,
            },
            take: 10,
          },
    },
  });

  if (!brand) throw new Error(`Brand ${brandId} not found`);

  // Resolve products
  let products: BrandProduct[] = [];
  if (campaignId && brand.campaigns?.[0]) {
    const campaign = brand.campaigns[0] as CampaignProductsSelection;
    products = (campaign.campaignProducts ?? []).map((cp) => cp.product);
  } else if (brand.products) {
    products = brand.products;
  }

  const profile = brand.settings?.brandProfile as Record<string, unknown> | null ?? null;

  const targetAudience =
    _str(profile?.targetAudience) ??
    _str(profile?.audience) ??
    _str(profile?.target_audience) ??
    null;

  const niche =
    _str(profile?.niche) ??
    _str(profile?.category) ??
    _str(profile?.industry) ??
    null;

  const brandVoice =
    brand.settings?.brandVoice ??
    _str(profile?.tone) ??
    _str(profile?.brandVoice) ??
    null;

  const summary = _buildSummary({
    brandName: brand.name,
    websiteUrl: brand.websiteUrl,
    targetAudience,
    niche,
    brandVoice,
    products,
  });

  return {
    brandName: brand.name,
    websiteUrl: brand.websiteUrl ?? null,
    brandProfile: profile,
    targetAudience,
    niche,
    brandVoice,
    products,
    summary,
  };
}

// ─── ICP → search criteria translation ────────────────────────────────────

/**
 * Translate a BrandICP into keyword hints for the Fly worker search.
 * Caller can merge these with user-supplied overrides.
 */
export function icpToSearchHints(icp: BrandICP): {
  keywords: string[];
  category?: string;
} {
  const keywords: string[] = [];

  if (icp.niche) keywords.push(icp.niche);
  if (icp.targetAudience) keywords.push(icp.targetAudience);

  for (const p of icp.products.slice(0, 3)) {
    if (p.name) keywords.push(p.name);
  }

  return {
    keywords: [...new Set(keywords.map((k) => k.toLowerCase()))],
    category: icp.niche ?? undefined,
  };
}

// ─── ICP → fit-scoring system prompt ──────────────────────────────────────

/**
 * Build a concise system-prompt snippet describing the brand ICP.
 * Used by AI fit-scoring calls.
 */
export function icpToSystemPrompt(icp: BrandICP): string {
  return [
    `Brand: ${icp.brandName}`,
    icp.websiteUrl ? `Website: ${icp.websiteUrl}` : null,
    icp.niche ? `Niche: ${icp.niche}` : null,
    icp.targetAudience ? `Target audience: ${icp.targetAudience}` : null,
    icp.brandVoice ? `Brand voice: ${icp.brandVoice}` : null,
    icp.products.length
      ? `Products: ${icp.products.map((p) => p.name).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Internal ──────────────────────────────────────────────────────────────

function _str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function _buildSummary(parts: {
  brandName: string;
  websiteUrl?: string | null;
  targetAudience?: string | null;
  niche?: string | null;
  brandVoice?: string | null;
  products: BrandProduct[];
}): string {
  const lines: string[] = [`${parts.brandName} is a brand`];

  if (parts.niche) lines[0] += ` in the ${parts.niche} space`;
  if (parts.websiteUrl) lines.push(`Website: ${parts.websiteUrl}`);
  if (parts.targetAudience) lines.push(`Audience: ${parts.targetAudience}`);
  if (parts.brandVoice) lines.push(`Voice: ${parts.brandVoice}`);
  if (parts.products.length) {
    lines.push(
      `Products: ${parts.products
        .slice(0, 5)
        .map((p) => p.name)
        .join(", ")}`
    );
  }

  return lines.join(". ");
}
