import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ campaignId: string }> };

async function authorize(campaignId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) throw new Error("Unauthorized");

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) throw new Error("User not found");

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) throw new Error("No brand found");

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId: membership.brandId },
  });

  if (!campaign) throw new Error("Campaign not found");

  return { brandId: membership.brandId, campaign };
}

/**
 * GET /api/campaigns/:campaignId/products — List products for this campaign.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    await authorize(campaignId);

    const campaignProducts = await prisma.campaignProduct.findMany({
      where: { campaignId },
      include: {
        product: true,
        shopifyProduct: {
          include: { variants: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products: campaignProducts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";
    const status =
      message === "Unauthorized" ? 401 :
      message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/campaigns/:campaignId/products — Update product selection.
 * Body: { shopifyProductIds: string[] }
 *
 * Replaces the campaign's Shopify product associations.
 * For each Shopify product, auto-creates/reuses a BrandProduct to satisfy the
 * existing CampaignProduct -> BrandProduct FK.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const { brandId } = await authorize(campaignId);

    const body = (await request.json()) as { shopifyProductIds?: string[] };
    const shopifyProductIds = body.shopifyProductIds ?? [];

    // Fetch the Shopify products to get their data
    const shopifyProducts = await prisma.shopifyProduct.findMany({
      where: {
        id: { in: shopifyProductIds },
        brandId,
      },
      include: { variants: true },
    });

    // Ensure BrandProduct exists for each Shopify product
    const brandProductMap = new Map<string, string>();
    for (const sp of shopifyProducts) {
      // Try to find existing BrandProduct linked to this Shopify product
      let brandProduct = await prisma.brandProduct.findFirst({
        where: {
          brandId,
          shopifyProductId: sp.shopifyId,
        },
      });

      if (!brandProduct) {
        // Create a BrandProduct from the Shopify product data
        const firstVariant = sp.variants[0];
        brandProduct = await prisma.brandProduct.create({
          data: {
            name: sp.title,
            description: sp.description,
            shopifyProductId: sp.shopifyId,
            shopifyVariantId: firstVariant?.shopifyVariantId || null,
            retailValue: firstVariant
              ? Math.round(parseFloat(firstVariant.price) * 100)
              : null,
            brandId,
          },
        });
      }

      brandProductMap.set(sp.id, brandProduct.id);
    }

    // Remove existing campaign products, then recreate
    await prisma.campaignProduct.deleteMany({
      where: { campaignId },
    });

    if (shopifyProductIds.length > 0) {
      await prisma.campaignProduct.createMany({
        data: shopifyProducts.map((sp) => ({
          campaignId,
          productId: brandProductMap.get(sp.id)!,
          shopifyProductId: sp.id,
        })),
      });
    }

    // Fetch updated list
    const updated = await prisma.campaignProduct.findMany({
      where: { campaignId },
      include: {
        product: true,
        shopifyProduct: {
          include: { variants: true },
        },
      },
    });

    return NextResponse.json({ products: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update products";
    const status =
      message === "Unauthorized" ? 401 :
      message === "Campaign not found" ? 404 : 500;
    console.error("[campaigns/products/PUT]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
