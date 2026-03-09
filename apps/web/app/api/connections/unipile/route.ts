import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { disconnectProvider, upsertBrandConnection, upsertProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/connections/unipile — Save Unipile API credentials for a brand.
 *
 * Body: { apiKey: string, accountId?: string }
 *
 * Encrypts and stores the API key as a ProviderCredential (provider="unipile").
 * Also creates/updates BrandConnection for status tracking.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership({ requireAdmin: true });

    const body = (await request.json()) as {
      apiKey: string;
      accountId?: string;
    };

    if (!body.apiKey || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Encrypt the credentials
    const encryptedValue = encrypt(
      JSON.stringify({
        apiKey: body.apiKey.trim(),
        accountId: body.accountId?.trim() || "",
      })
    );

    await upsertProviderCredential(prisma, {
      provider: "unipile",
      label: "Unipile Instagram DM",
      encryptedValue,
      brandId: membership.brandId,
      credentialType: "api_key",
    });

    await upsertBrandConnection(prisma, {
      provider: "unipile",
      status: "connected",
      brandId: membership.brandId,
      connectionMethod: "manual",
      metadata: { accountId: body.accountId?.trim() || "" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/unipile/POST]", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const membership = await getCurrentBrandMembership({ requireAdmin: true });
    await disconnectProvider(prisma, membership.brandId, "unipile");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/unipile/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Unipile" },
      { status: 500 }
    );
  }
}
