import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ai-personas — List custom AI personas for the user's brand.
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
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const personas = await prisma.aiPersona.findMany({
      where: { brandId: membership.brandId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(personas);
  } catch (error) {
    console.error("[ai-personas/GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-personas — Create a new custom AI persona.
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

    const body = await request.json();
    const { name, description, tone, systemPrompt, exampleMessages, isDefault } =
      body;

    if (!name || !tone || !systemPrompt) {
      return NextResponse.json(
        { error: "name, tone, and systemPrompt are required" },
        { status: 400 }
      );
    }

    if (!["professional", "casual", "influencer"].includes(tone)) {
      return NextResponse.json(
        { error: "tone must be professional, casual, or influencer" },
        { status: 400 }
      );
    }

    const persona = await prisma.aiPersona.create({
      data: {
        name,
        description: description ?? null,
        tone,
        systemPrompt,
        exampleMessages: exampleMessages ?? [],
        isDefault: isDefault ?? false,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    console.error("[ai-personas/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
