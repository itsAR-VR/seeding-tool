import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { getFeatureFlags, setFeatureFlag, type FeatureFlags } from "@/lib/feature-flags";

/**
 * GET /api/settings/feature-flags — returns current flags for brand
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
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand access" }, { status: 403 });
    }

    // Check admin role
    if (membership.role !== "owner" && membership.role !== "editor") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const flags = await getFeatureFlags(membership.brandId);
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[feature-flags] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/feature-flags — update a single flag
 * Body: { flag: string, value: boolean }
 */
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: "No brand access" }, { status: 403 });
    }

    // Check admin role
    if (membership.role !== "owner" && membership.role !== "editor") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as { flag?: string; value?: boolean };

    if (!body.flag || typeof body.value !== "boolean") {
      return NextResponse.json(
        { error: "Missing flag or value" },
        { status: 400 }
      );
    }

    const validFlags: Array<keyof FeatureFlags> = [
      "aiReplyEnabled",
      "unipileDmEnabled",
      "shopifyOrderEnabled",
      "reminderEmailEnabled",
    ];

    if (!validFlags.includes(body.flag as keyof FeatureFlags)) {
      return NextResponse.json(
        { error: `Invalid flag: ${body.flag}` },
        { status: 400 }
      );
    }

    await setFeatureFlag(
      membership.brandId,
      body.flag as keyof FeatureFlags,
      body.value
    );

    const flags = await getFeatureFlags(membership.brandId);
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[feature-flags] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
