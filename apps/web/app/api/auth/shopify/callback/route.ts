import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { encrypt } from "@/lib/encryption";
import { assertBrandAccess, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  buildConnectionRedirect,
  decodeIntegrationOAuthState,
} from "@/lib/integrations/oauth-state";
import { upsertBrandConnection, upsertProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";
import { syncProducts } from "@/lib/shopify/products";
import { updateShopifyConnectionStatus } from "@/lib/shopify/status";
import { registerWebhooks } from "@/lib/shopify/webhooks";

const SHOPIFY_OAUTH_STATE_COOKIE = "shopify_oauth_state";

function normalizeShopDomain(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "");
}

function safeCompare(a: string, b: string) {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function verifyShopifyCallbackHmac(
  requestUrl: URL,
  apiSecret: string
) {
  const hmac = requestUrl.searchParams.get("hmac");
  if (!hmac) {
    return false;
  }

  const message = Array.from(requestUrl.searchParams.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  return safeCompare(digest, hmac);
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const requestUrl = new URL(request.url);
  const state = decodeIntegrationOAuthState(requestUrl.searchParams.get("state"));
  const brandId = state?.brandId ?? null;
  const shop = normalizeShopDomain(requestUrl.searchParams.get("shop") ?? "");
  const code = requestUrl.searchParams.get("code");
  const hmacValid = apiSecret
    ? verifyShopifyCallbackHmac(requestUrl, apiSecret)
    : false;

  const redirectTo = (params: Record<string, string>) => {
    const response = NextResponse.redirect(
      buildConnectionRedirect(appUrl, state?.returnTo, params)
    );
    response.cookies.delete(SHOPIFY_OAUTH_STATE_COOKIE);
    return response;
  };

  if (!apiKey || !apiSecret) {
    return redirectTo({ error: "internal" });
  }

  if (!brandId || !shop || !code) {
    return redirectTo({ error: "missing_params" });
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return redirectTo({ error: "missing_params" });
  }

  if (!hmacValid) {
    return redirectTo({ error: "invalid_signature" });
  }

  const nonceCookie = request.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value ?? "";
  if (!state?.nonce || !safeCompare(state.nonce, nonceCookie)) {
    return redirectTo({ error: "invalid_state" });
  }

  try {
    await assertBrandAccess(brandId, { requireAdmin: true });
  } catch (error) {
    if (error instanceof BrandAccessError && error.status === 401) {
      const response = NextResponse.redirect(`${appUrl}/login`);
      response.cookies.delete(SHOPIFY_OAUTH_STATE_COOKIE);
      return response;
    }
    return redirectTo({ error: "forbidden" });
  }

  const tokenResponse = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    }
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[shopify-callback] Token exchange failed:", errorText);
    return redirectTo({ error: "token_exchange" });
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    scope?: string;
  };

  const accessToken = tokenPayload.access_token?.trim();
  if (!accessToken) {
    return redirectTo({ error: "token_exchange" });
  }

  const encryptedValue = encrypt(accessToken);

  await prisma.$transaction(async (tx) => {
    await upsertProviderCredential(tx, {
      brandId,
      provider: "shopify",
      label: shop,
      encryptedValue,
      credentialType: "oauth_access_token",
    });

    await upsertBrandConnection(tx, {
      brandId,
      provider: "shopify",
      status: "connected",
      connectionMethod: "oauth",
      externalId: shop,
      metadata: {
        oauthScopes: tokenPayload.scope ?? null,
      },
    });
  });

  const callbackBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  try {
    await registerWebhooks(shop, accessToken, callbackBaseUrl);
  } catch (error) {
    console.warn("[shopify-callback] Webhook registration failed:", error);
  }

  try {
    const result = await syncProducts(brandId);
    await updateShopifyConnectionStatus(brandId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncError: null,
      lastSyncedCount: result.synced,
      truncated: result.truncated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Initial product sync failed";
    await updateShopifyConnectionStatus(brandId, {
      lastSyncAt: new Date().toISOString(),
      lastSyncError: message,
      lastSyncedCount: null,
      truncated: null,
    });
    console.warn("[shopify-callback] Initial sync failed:", error);
  }

  return redirectTo({ connected: "shopify" });
}
