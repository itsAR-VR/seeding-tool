import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { resolveProviderCredential, upsertBrandConnection, upsertProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";
import { registerWebhooks, cleanupWebhooks } from "@/lib/shopify/webhooks";
import { syncProducts } from "@/lib/shopify/products";
import {
  getShopifyConnectionStatus,
  updateShopifyConnectionStatus,
} from "@/lib/shopify/status";

const SHOPIFY_API_VERSION = "2024-01";

async function getCurrentBrandId() {
  const membership = await getCurrentBrandMembership({ requireAdmin: true });
  return membership.brandId;
}

function normalizeStoreDomain(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "");
}

async function getErrorText(response: Response) {
  const text = await response.text();
  return text || response.statusText || "Request failed";
}

export async function GET() {
  try {
    const brandId = await getCurrentBrandId();
    return NextResponse.json(await getShopifyConnectionStatus(brandId));
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/shopify/GET]", error);
    return NextResponse.json(
      { error: "Failed to load Shopify connection" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const brandId = await getCurrentBrandId();
    const body = (await request.json()) as {
      storeDomain?: string;
      accessToken?: string;
    };

    const storeDomain = normalizeStoreDomain(body.storeDomain ?? "");
    const accessToken = body.accessToken?.trim() ?? "";

    if (!storeDomain || !accessToken) {
      return NextResponse.json(
        { error: "Store domain and access token are required" },
        { status: 400 }
      );
    }

    const validationResponse = await fetch(
      `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        {
          error: `Shopify validation failed: ${await getErrorText(validationResponse)}`,
        },
        { status: 400 }
      );
    }

    const encryptedValue = encrypt(accessToken);

    await prisma.$transaction(async (tx) => {
      await upsertProviderCredential(tx, {
        brandId,
        provider: "shopify",
        label: storeDomain,
        encryptedValue,
        credentialType: "shopify_admin_token",
      });

      await upsertBrandConnection(tx, {
        brandId,
        provider: "shopify",
        status: "connected",
        connectionMethod: "manual",
        externalId: storeDomain,
      });
    });

    // Register webhooks (non-blocking — warn on failure)
    const callbackBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    try {
      const whResult = await registerWebhooks(
        storeDomain,
        accessToken,
        callbackBaseUrl
      );
      console.log(
        "[connections/shopify/POST] Webhooks registered:",
        JSON.stringify(whResult)
      );
    } catch (whErr) {
      console.warn(
        "[connections/shopify/POST] Webhook registration failed (non-fatal):",
        whErr
      );
    }

    // Trigger initial product sync (non-blocking — warn on failure)
    try {
      const result = await syncProducts(brandId);
      await updateShopifyConnectionStatus(brandId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncError: null,
        lastSyncedCount: result.synced,
        truncated: result.truncated,
      });
      console.log("[connections/shopify/POST] Initial product sync completed");
    } catch (syncErr) {
      const message =
        syncErr instanceof Error ? syncErr.message : "Initial product sync failed";
      await updateShopifyConnectionStatus(brandId, {
        lastSyncAt: new Date().toISOString(),
        lastSyncError: message,
        lastSyncedCount: null,
        truncated: null,
      });
      console.warn(
        "[connections/shopify/POST] Initial product sync failed (non-fatal):",
        syncErr
      );
    }

    return NextResponse.json({
      connected: true,
      storeDomain,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/shopify/POST]", error);
    return NextResponse.json(
      { error: "Failed to save Shopify connection" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const brandId = await getCurrentBrandId();

    // Attempt to cleanup webhooks before disconnecting
    const resolved = await resolveProviderCredential(brandId, "shopify");

    if (resolved.decryptedValue && resolved.connection?.externalId) {
      const callbackBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      try {
        const result = await cleanupWebhooks(
          resolved.connection.externalId,
          resolved.decryptedValue,
          callbackBaseUrl
        );
        console.log(
          "[connections/shopify/DELETE] Webhooks cleaned up:",
          JSON.stringify(result)
        );
      } catch (cleanupErr) {
        console.warn(
          "[connections/shopify/DELETE] Webhook cleanup failed (non-fatal):",
          cleanupErr
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.providerCredential.updateMany({
        where: { brandId, provider: "shopify" },
        data: { isValid: false },
      });

      const existingConnection = await tx.brandConnection.findFirst({
        where: { brandId, provider: "shopify" },
      });

      await upsertBrandConnection(tx, {
        brandId,
        provider: "shopify",
        status: "disconnected",
        connectionMethod:
          existingConnection?.connectionMethod === "oauth" ? "oauth" : "manual",
        externalId: existingConnection?.externalId ?? null,
        metadata: existingConnection?.metadata ?? undefined,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/shopify/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Shopify" },
      { status: 500 }
    );
  }
}
