import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/brands/current
 * Returns the first brand the current user has membership in.
 */
export async function GET() {
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
      include: {
        brand: {
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
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    return NextResponse.json(membership.brand);
  } catch (error) {
    console.error("[brands/current]", error);
    return NextResponse.json(
      { error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}
