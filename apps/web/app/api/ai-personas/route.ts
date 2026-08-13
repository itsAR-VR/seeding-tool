import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/ai-personas — List custom AI personas for the user's brand.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const personas = await prisma.aiPersona.findMany({
      where: { brandId: membership.brandId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(personas);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ai-personas/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
