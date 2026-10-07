import { NextRequest, NextResponse } from "next/server";
import {
  BrandAccessError,
  getAuthorizedCampaign,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { syncProducts, getProducts } from "@/lib/shopify/products";
import { updateShopifyConnectionStatus } from "@/lib/shopify/status";
import { getShopifyClient, ShopifyNotConnectedError } from "@/lib/shopify/client";
import { registerWebhooks } from "@/lib/shopify/webhooks";
import { WEBHOOK_CALLBACK_URL } from "@/lib/config";

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

    console.error("[products/sync/GET]", error);
    return NextResponse.json({ error: "Couldn't load your products. Refresh the page to try again." }, { status: 500 });
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
    // Keep webhook subscriptions current (adds any newly required topics).
    try {
      const client = await getShopifyClient(brandId);
      await registerWebhooks(client.storeDomain, client.accessToken, WEBHOOK_CALLBACK_URL);
    } catch (webhookError) {
      console.warn("[products/sync] webhook refresh failed", webhookError);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ShopifyNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    console.error("[products/sync/POST]", error);
    return NextResponse.json(
      { error: "Couldn't bring in your Shopify products. Try again, or reconnect Shopify in Settings > Connections." },
      { status: 502 }
    );
  }
}
