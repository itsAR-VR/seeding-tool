import { prisma } from "@/lib/prisma";

/** Creator-facing content that differs per brand, with safe generic fallbacks. */
export type BrandKit = {
  brandId: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  senderFirstName: string;
  brandDescription: string | null;
  productFacts: string | null;
  replyExamples: string | null;
  followUpTemplate: string;
  adDefaultText: string;
  adDefaultHeadline: string;
  adDefaultLink: string;
  shipCountries: string[];
};

export const DEFAULT_FOLLOW_UP_TEMPLATE = `Thank you! Here's a link to add your shipping info, and I'll get it out to you shortly:
{address link}

I'll let you know when it ships.`;

export async function getBrandKit(brandId: string): Promise<BrandKit | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      logoUrl: true,
      senderFirstName: true,
      brandDescription: true,
      productFacts: true,
      replyExamples: true,
      followUpTemplate: true,
      adDefaultText: true,
      adDefaultHeadline: true,
      adDefaultLink: true,
      shipCountries: true,
    },
  });
  if (!brand) return null;
  return {
    brandId: brand.id,
    name: brand.name,
    logoUrl: brand.logoUrl,
    websiteUrl: brand.websiteUrl,
    senderFirstName: brand.senderFirstName?.trim() || brand.name,
    brandDescription: brand.brandDescription,
    productFacts: brand.productFacts?.trim() || null,
    replyExamples: brand.replyExamples?.trim() || null,
    followUpTemplate: brand.followUpTemplate?.trim() || DEFAULT_FOLLOW_UP_TEMPLATE,
    adDefaultText: brand.adDefaultText ?? "",
    adDefaultHeadline: brand.adDefaultHeadline ?? "",
    adDefaultLink: brand.adDefaultLink ?? brand.websiteUrl ?? "",
    shipCountries: brand.shipCountries.length > 0 ? brand.shipCountries : ["US"],
  };
}

/** "the US", "the US or Canada", … for prompts and messages. */
export function describeCountries(codes: string[]): string {
  const names: Record<string, string> = { US: "the US", CA: "Canada", GB: "the UK", AU: "Australia" };
  const list = codes.map((c) => names[c] ?? c);
  if (list.length <= 1) return list[0] ?? "the US";
  return `${list.slice(0, -1).join(", ")} or ${list[list.length - 1]}`;
}
