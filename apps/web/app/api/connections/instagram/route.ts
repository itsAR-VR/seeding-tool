import { NextResponse } from "next/server";
import { BrandAccessError, getCurrentBrandMembership } from "@/lib/integrations/brand-access";
import { disconnectProvider } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";

async function getCurrentBrandId() {
  const membership = await getCurrentBrandMembership({ requireAdmin: true });
  return membership.brandId;
}

/**
 * GET /api/connections/instagram
 * Returns the Instagram connection status for the current brand.
 */
export async function GET() {
  try {
    const brandId = await getCurrentBrandId();

    const [credential, connection] = await Promise.all([
      prisma.providerCredential.findFirst({
        where: {
          brandId,
          provider: "instagram",
          isValid: true,
        },
      }),
      prisma.brandConnection.findFirst({
        where: {
          brandId,
          provider: "instagram",
        },
      }),
    ]);

    return NextResponse.json({
      connected: Boolean(credential && connection?.status === "connected"),
      username: connection?.externalId ?? credential?.label ?? undefined,
      status: connection?.status ?? "disconnected",
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("[connections/instagram/GET]", error);
    return NextResponse.json(
      { error: "Failed to load Instagram connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/instagram
 * Disconnect Instagram for the current brand.
 */
export async function DELETE() {
  try {
    const brandId = await getCurrentBrandId();
    await disconnectProvider(prisma, brandId, "instagram");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("[connections/instagram/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Instagram" },
      { status: 500 }
    );
  }
}
