import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
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

    // Verify user has access to this brand
    const membership = await prisma.brandMembership.findUnique({
      where: {
        userId_brandId: { userId: user.id, brandId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        settings: true,
        onboarding: true,
        connections: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error("[brands/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch brand" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
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

    // Verify user has access
    const membership = await prisma.brandMembership.findUnique({
      where: {
        userId_brandId: { userId: user.id, brandId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, websiteUrl, logoUrl, brandVoice, timezone } = body as {
      name?: string;
      websiteUrl?: string;
      logoUrl?: string;
      brandVoice?: string;
      timezone?: string;
    };

    // Update brand name if provided
    if (name) {
      await prisma.brand.update({
        where: { id: brandId },
        data: { name: name.trim() },
      });
    }

    // Update brand settings
    const settingsData: Record<string, string | undefined> = {};
    if (brandVoice !== undefined) settingsData.brandVoice = brandVoice;
    if (timezone !== undefined) settingsData.timezone = timezone;

    // Store websiteUrl and logoUrl in brandVoice metadata for now
    // (schema doesn't have dedicated fields — these go in settings)
    if (websiteUrl !== undefined || logoUrl !== undefined) {
      const existing = await prisma.brandSettings.findUnique({
        where: { brandId },
      });
      const currentVoice = existing?.brandVoice ?? "";
      let updatedVoice = currentVoice;

      if (websiteUrl !== undefined) {
        // Replace or append website URL
        const websiteRegex = /Brand website: .+/;
        if (websiteRegex.test(updatedVoice)) {
          updatedVoice = updatedVoice.replace(
            websiteRegex,
            `Brand website: ${websiteUrl}`
          );
        } else if (websiteUrl) {
          updatedVoice = updatedVoice
            ? `${updatedVoice}\nBrand website: ${websiteUrl}`
            : `Brand website: ${websiteUrl}`;
        }
      }

      if (logoUrl !== undefined) {
        const logoRegex = /Logo URL: .+/;
        if (logoRegex.test(updatedVoice)) {
          updatedVoice = updatedVoice.replace(
            logoRegex,
            `Logo URL: ${logoUrl}`
          );
        } else if (logoUrl) {
          updatedVoice = updatedVoice
            ? `${updatedVoice}\nLogo URL: ${logoUrl}`
            : `Logo URL: ${logoUrl}`;
        }
      }

      settingsData.brandVoice = updatedVoice;
    }

    if (Object.keys(settingsData).length > 0) {
      await prisma.brandSettings.upsert({
        where: { brandId },
        create: { brandId, ...settingsData },
        update: settingsData,
      });
    }

    const updated = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { settings: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[brands/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 }
    );
  }
}
