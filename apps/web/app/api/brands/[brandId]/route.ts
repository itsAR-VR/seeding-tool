import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  fetchBrandProfile,
  normalizeBrandWebsiteUrl,
} from "@/lib/brands/profile";

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

    const existingSettings = await prisma.brandSettings.findUnique({
      where: { brandId },
    });

    let normalizedWebsiteUrl: string | null | undefined;
    if (websiteUrl !== undefined) {
      try {
        normalizedWebsiteUrl = normalizeBrandWebsiteUrl(websiteUrl);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Website URL must be a valid http(s) URL",
          },
          { status: 400 }
        );
      }
    }

    let extractedBrandProfile: Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined;
    if (websiteUrl !== undefined) {
      if (normalizedWebsiteUrl) {
        try {
          extractedBrandProfile = JSON.parse(
            JSON.stringify(await fetchBrandProfile(normalizedWebsiteUrl))
          ) as Prisma.InputJsonValue;
        } catch (error) {
          console.warn("[brands/PATCH] brand profile extraction failed", {
            brandId,
            websiteUrl: normalizedWebsiteUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          extractedBrandProfile = Prisma.JsonNull;
        }
      } else {
        extractedBrandProfile = Prisma.JsonNull;
      }
    }

    const brandData: { name?: string; websiteUrl?: string | null } = {};
    if (name !== undefined) {
      brandData.name = name.trim();
    }
    if (websiteUrl !== undefined) {
      brandData.websiteUrl = normalizedWebsiteUrl ?? null;
    }

    if (Object.keys(brandData).length > 0) {
      await prisma.brand.update({
        where: { id: brandId },
        data: brandData,
      });
    }

    const settingsData: {
      brandVoice?: string | null;
      timezone?: string;
      brandProfile?: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
    } = {};

    if (brandVoice !== undefined) {
      settingsData.brandVoice = brandVoice || null;
    }
    if (timezone !== undefined) {
      settingsData.timezone = timezone;
    }
    if (extractedBrandProfile !== undefined) {
      settingsData.brandProfile = extractedBrandProfile;
    }

    if (logoUrl !== undefined) {
      const currentVoice =
        settingsData.brandVoice ?? existingSettings?.brandVoice ?? "";
      const withoutLogo = currentVoice
        .replace(/\n?Logo URL: .+/g, "")
        .trim();
      settingsData.brandVoice = logoUrl
        ? [withoutLogo, `Logo URL: ${logoUrl}`].filter(Boolean).join("\n")
        : withoutLogo || null;
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
