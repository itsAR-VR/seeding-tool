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

    console.error("[connections/shopify/status]", error);
    return NextResponse.json(
      { error: "Couldn't check your Shopify connection. Refresh the page to try again." },
      { status: 500 }
    );
  }
}
