import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ personaId: string }>;
};

/**
 * PUT /api/ai-personas/[personaId] — Update a custom AI persona.
 */
export async function PUT(request: NextRequest, { params }: RouteProps) {
  try {
    const { personaId } = await params;

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
    console.error("[ai-personas/DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
