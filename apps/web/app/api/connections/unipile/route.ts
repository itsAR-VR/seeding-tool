import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

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
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

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

    // Upsert ProviderCredential
    await prisma.providerCredential.upsert({
      where: {
        brandId_provider: {
          brandId: membership.brandId,
          provider: "unipile",
        },
      },
      update: {
        encryptedValue,
        isValid: true,
      },
      create: {
        provider: "unipile",
        label: "Unipile Instagram DM",
        encryptedValue,
        brandId: membership.brandId,
        isValid: true,
      },
    });

    // Upsert BrandConnection for UI status
    await prisma.brandConnection.upsert({
      where: {
        brandId_provider: {
          brandId: membership.brandId,
          provider: "unipile",
        },
      },
      update: {
        status: "connected",
        metadata: { accountId: body.accountId?.trim() || "" },
      },
      create: {
        provider: "unipile",
        status: "connected",
        brandId: membership.brandId,
        metadata: { accountId: body.accountId?.trim() || "" },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[connections/unipile/POST]", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}
