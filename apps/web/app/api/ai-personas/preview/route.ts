import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { generateOutreachDraft } from "@/lib/ai/outreach-drafter";
import type { OutreachPersona } from "@/lib/ai/personas";

/**
 * POST /api/ai-personas/preview
 *
 * Generate a sample draft with a persona (for preview in settings).
 *
 * Body: {
 *   name: string;
 *   tone: string;
 *   systemPrompt: string;
 *   exampleMessages?: string[];
 *   channel?: "email" | "instagram_dm";
 * }
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
    const { name, tone, systemPrompt, exampleMessages, channel = "email" } = body;

    if (!systemPrompt) {
      return NextResponse.json(
        { error: "systemPrompt is required for preview" },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: membership.brandId },
      select: { name: true },
    });

    const persona: OutreachPersona = {
      id: "preview",
      name: name ?? "Preview",
      description: "",
      tone: tone ?? "professional",
      systemPrompt,
      exampleMessages: exampleMessages ?? [],
    };

    const draft = await generateOutreachDraft({
      creatorProfile: {
        handle: "sample_creator",
        name: "Alex Johnson",
        followerCount: 25000,
        bio: "Lifestyle & wellness content 🌿 Based in LA",
        niche: "lifestyle",
      },
      campaign: {
        name: "Sample Campaign",
        description: "A product seeding campaign for our latest launch.",
        products: [
          {
            name: "Premium Wellness Kit",
            description: "Our bestselling wellness starter kit",
            retailValue: 7500,
          },
        ],
      },
      persona,
      channel,
      brandName: brand?.name ?? "Your Brand",
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("[ai-personas/preview/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
