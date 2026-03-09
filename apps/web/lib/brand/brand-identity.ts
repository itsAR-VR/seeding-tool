/**
 * Brand identity adapter.
 *
 * Keeps the older `composeBrandIdentity` API shape, but sources its data from
 * the canonical Brand ICP helpers in `@/lib/brands/icp`.
 */

import { deriveBrandICP, icpToSearchHints } from "@/lib/brands/icp";

export interface BrandIdentityContext {
  brandId: string;
  brandName: string;
  websiteUrl?: string;
  profileSummary: string;
  icpSegments: string[];
  icpKeywords: string[];
  campaignDescription?: string;
  productContext?: string;
  brandVoice?: string;
}

export async function composeBrandIdentity(
  brandId: string,
  campaignId?: string
): Promise<BrandIdentityContext> {
  const icp = await deriveBrandICP(brandId, campaignId);
  const hints = icpToSearchHints(icp);

  const icpSegments = Array.from(
    new Set(
      [
        icp.niche,
        icp.targetAudience,
        ...icp.products.map((product) => product.name),
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );

  const productContext = icp.products.length
    ? `Campaign products: ${icp.products
        .map((product) =>
          product.description
            ? `${product.name} (${product.description})`
            : product.name
        )
        .join(", ")}`
    : undefined;

  return {
    brandId,
    brandName: icp.brandName,
    websiteUrl: icp.websiteUrl ?? undefined,
    profileSummary: icp.summary,
    icpSegments,
    icpKeywords: hints.keywords,
    productContext,
    brandVoice: icp.brandVoice ?? undefined,
  };
}
