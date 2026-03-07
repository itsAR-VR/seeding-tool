import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId, requireOrg } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

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

    const org = await requireOrg(user.id);

    const body = await request.json();
    const { name, websiteUrl } = body as {
      name?: string;
      websiteUrl?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Brand name is required" },
        { status: 400 }
      );
    }

    // Find or create a default client for this org
    let client = await prisma.client.findFirst({
      where: { organizationId: org.id },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: org.name,
          organizationId: org.id,
        },
      });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create brand + onboarding + settings in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: {
          name: name.trim(),
          slug: `${slug}-${Date.now().toString(36)}`,
          clientId: client.id,
        },
      });

      await tx.brandOnboarding.create({
        data: {
          brandId: brand.id,
          currentStep: 1,
          completedSteps: JSON.stringify([1]),
        },
      });

      await tx.brandSettings.create({
        data: {
          brandId: brand.id,
          brandVoice: websiteUrl ? `Brand website: ${websiteUrl}` : undefined,
        },
      });

      // Add user as brand owner
      await tx.brandMembership.create({
        data: {
          userId: user!.id,
          brandId: brand.id,
          role: "owner",
        },
      });

      return brand;
    });

    return NextResponse.json({
      brandId: result.id,
      slug: result.slug,
    });
  } catch (error) {
    console.error("[onboarding/brand]", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
