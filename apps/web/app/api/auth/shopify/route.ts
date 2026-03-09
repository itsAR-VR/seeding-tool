import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { assertBrandAccess, BrandAccessError } from "@/lib/integrations/brand-access";
import { encodeIntegrationOAuthState } from "@/lib/integrations/oauth-state";

const SHOPIFY_OAUTH_STATE_COOKIE = "shopify_oauth_state";

function normalizeShopDomain(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "");
}

function isValidShopDomain(shop: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);

  const brandId = searchParams.get("brandId");
  const returnTo = searchParams.get("returnTo") ?? undefined;
  const shop = normalizeShopDomain(searchParams.get("shop") ?? "");

  if (!brandId || !shop) {
    return new Response("Missing brandId or shop parameter", { status: 400 });
  }

  if (!isValidShopDomain(shop)) {
    return new Response("Invalid Shopify store domain", { status: 400 });
  }

  try {
    await assertBrandAccess(brandId, { requireAdmin: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return new Response(error.message, { status: error.status });
    }

    return new Response("Forbidden", { status: 403 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_APP_SCOPES;

  if (!apiKey || !scopes) {
    return new Response("Shopify OAuth not configured", { status: 500 });
  }

  const nonce = randomUUID();
  const state = encodeIntegrationOAuthState({ brandId, returnTo, nonce });
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: `${appUrl}/api/auth/shopify/callback`,
    state,
  });

  const response = NextResponse.redirect(
    `https://${shop}/admin/oauth/authorize?${params}`
  );

  response.cookies.set({
    name: SHOPIFY_OAUTH_STATE_COOKIE,
    value: nonce,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
