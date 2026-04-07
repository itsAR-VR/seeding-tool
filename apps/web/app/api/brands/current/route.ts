import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/brands/current
 * Returns the active brand for the current user (cookie-aware).
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const brand = await prisma.brand.findUnique({
      where: { id: membership.brandId },
      include: {
        settings: true,
        onboarding: true,
        connections: true,
        providerCredentials: {
          select: {
            provider: true,
            credentialType: true,
            isValid: true,
          },
        },
        emailAliases: {
          select: {
            id: true,
            address: true,
            displayName: true,
            isPrimary: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { updatedAt: "desc" },
          ],
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json(brand);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[brands/current]", error);
    return NextResponse.json(
      { error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}
