import { NextRequest, NextResponse } from "next/server";
import {
  BrandAccessError,
  getAuthorizedCampaign,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { syncProducts, getProducts } from "@/lib/shopify/products";
import { updateShopifyConnectionStatus } from "@/lib/shopify/status";

async function getBrandId(request: NextRequest): Promise<string> {
  const campaignId = request.nextUrl.searchParams.get("campaignId");

  if (campaignId) {
    return (await getAuthorizedCampaign(campaignId)).brandId;
  }

  return (await getCurrentBrandMembership()).brandId;
}

/**
 * GET /api/products/sync — List synced Shopify products for the current brand.
 */
export async function GET(request: NextRequest) {
  try {
    const brandId = await getBrandId(request);
    const products = await getProducts(brandId);
    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch products";
    const status = message === "Unauthorized" ? 401 : message === "No brand found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/products/sync — Trigger a product sync from Shopify.
 */
export async function POST(request: NextRequest) {
  let brandId: string | null = null;

  try {
    brandId = await getBrandId(request);
    const result = await syncProducts(brandId);
    await updateShopifyConnectionStatus(brandId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncError: null,
      lastSyncedCount: result.synced,
      truncated: result.truncated,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Product sync failed";
    try {
      if (brandId) {
        await updateShopifyConnectionStatus(brandId, {
          lastSyncAt: new Date().toISOString(),
          lastSyncError: message,
          lastSyncedCount: null,
          truncated: null,
        });
      } else {
        brandId = await getBrandId(request);
        await updateShopifyConnectionStatus(brandId, {
          lastSyncAt: new Date().toISOString(),
          lastSyncError: message,
          lastSyncedCount: null,
          truncated: null,
        });
      }
    } catch {
      // ignore status update failures
    }
    const status = message === "Unauthorized" ? 401 : 500;
    console.error("[products/sync/POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
