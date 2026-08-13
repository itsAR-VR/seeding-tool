import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteProps = {
  params: Promise<{ personaId: string }>;
};

/**
 * PUT /api/ai-personas/[personaId] — Update a custom AI persona.
 */
export async function PUT(request: NextRequest, { params }: RouteProps) {
  try {
    const { personaId } = await params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Verify persona belongs to brand
    const existing = await prisma.aiPersona.findFirst({
      where: { id: personaId, brandId: membership.brandId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, tone, systemPrompt, exampleMessages, isDefault } =
      body;

    if (tone && !["professional", "casual", "influencer"].includes(tone)) {
      return NextResponse.json(
        { error: "tone must be professional, casual, or influencer" },
        { status: 400 }
      );
    }

    const persona = await prisma.aiPersona.update({
      where: { id: personaId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(tone !== undefined && { tone }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(exampleMessages !== undefined && { exampleMessages }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json(persona);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ai-personas/PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-personas/[personaId] — Delete a custom AI persona.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteProps
) {
  try {
    const { personaId } = await params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const existing = await prisma.aiPersona.findFirst({
      where: { id: personaId, brandId: membership.brandId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    await prisma.aiPersona.delete({ where: { id: personaId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ai-personas/DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
