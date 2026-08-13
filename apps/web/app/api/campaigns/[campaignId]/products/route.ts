import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId/products — List products for this campaign.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/products/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/campaigns/:campaignId/products — Update product selection.
 * Body: { shopifyProductIds: string[] }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const brandId = membership.brandId;
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
      let brandProduct = await prisma.brandProduct.findFirst({
        where: {
          brandId,
          shopifyProductId: sp.shopifyId,
        },
      });

      if (!brandProduct) {
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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/products/PUT]", error);
    return NextResponse.json(
      { error: "Failed to update products" },
      { status: 500 }
    );
  }
}
