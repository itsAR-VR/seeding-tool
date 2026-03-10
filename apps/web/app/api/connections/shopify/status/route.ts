import { NextRequest, NextResponse } from "next/server";
import {
  BrandAccessError,
  getAuthorizedCampaign,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getShopifyConnectionStatus } from "@/lib/shopify/status";

async function getBrandId(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaignId");

  if (campaignId) {
    return (await getAuthorizedCampaign(campaignId)).brandId;
  }

  return (await getCurrentBrandMembership()).brandId;
}

export async function GET(request: NextRequest) {
  try {
    const brandId = await getBrandId(request);
    return NextResponse.json(await getShopifyConnectionStatus(brandId));
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to load Shopify status";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "No brand found"
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
