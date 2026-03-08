import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { registerWebhooks, cleanupWebhooks } from "@/lib/shopify/webhooks";
import { syncProducts } from "@/lib/shopify/products";

const SHOPIFY_API_VERSION = "2024-01";

class ResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function getCurrentBrandId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new ResponseError("Unauthorized", 401);
  }

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) {
    throw new ResponseError("User not found", 404);
  }

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new ResponseError("No brand found", 404);
  }

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

    const [credential, connection] = await Promise.all([
      prisma.providerCredential.findFirst({
        where: {
          brandId,
          provider: "shopify",
          isValid: true,
        },
      }),
      prisma.brandConnection.findFirst({
        where: {
          brandId,
          provider: "shopify",
        },
      }),
    ]);

    return NextResponse.json({
      connected: Boolean(credential),
      storeDomain: connection?.externalId ?? credential?.label ?? undefined,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
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
      await tx.providerCredential.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "shopify",
          },
        },
        update: {
          label: storeDomain,
          encryptedValue,
          isValid: true,
        },
        create: {
          brandId,
          provider: "shopify",
          label: storeDomain,
          encryptedValue,
          isValid: true,
        },
      });

      await tx.brandConnection.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "shopify",
          },
        },
        update: {
          status: "connected",
          externalId: storeDomain,
        },
        create: {
          brandId,
          provider: "shopify",
          status: "connected",
          externalId: storeDomain,
        },
      });
    });

    // Register webhooks (non-blocking — warn on failure)
    const callbackBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

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
      await syncProducts(brandId);
      console.log("[connections/shopify/POST] Initial product sync completed");
    } catch (syncErr) {
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
    if (error instanceof ResponseError) {
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
    const credential = await prisma.providerCredential.findFirst({
      where: { brandId, provider: "shopify", isValid: true },
    });
    const connection = await prisma.brandConnection.findFirst({
      where: { brandId, provider: "shopify", status: "connected" },
    });

    if (credential && connection?.externalId) {
      const callbackBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      try {
        const accessToken = decrypt(credential.encryptedValue);
        const result = await cleanupWebhooks(
          connection.externalId,
          accessToken,
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
        where: {
          brandId,
          provider: "shopify",
        },
        data: {
          isValid: false,
        },
      });

      await tx.brandConnection.deleteMany({
        where: {
          brandId,
          provider: "shopify",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/shopify/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Shopify" },
      { status: 500 }
    );
  }
}
