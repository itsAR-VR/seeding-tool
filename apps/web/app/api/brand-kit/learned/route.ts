import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireWriteAccess,
} from "@/lib/integrations/brand-access";
import { LEARNED_EXAMPLES_IN_PROMPT } from "@/lib/inbox/learned-replies";

/** GET /api/brand-kit/learned — the replies the AI is currently learning from. */
export async function GET() {
  try {
    const { brandId } = await getCurrentBrandMembership();
    const replies = await prisma.learnedReply.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      take: LEARNED_EXAMPLES_IN_PROMPT,
      select: { id: true, question: true, answer: true, createdAt: true },
    });
    return NextResponse.json({ replies });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[brand-kit/learned GET]", error);
    return NextResponse.json({ error: "Couldn't load learned replies" }, { status: 500 });
  }
}

/** DELETE /api/brand-kit/learned?id= — stop the AI learning from one reply. */
export async function DELETE(request: Request) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const { count } = await prisma.learnedReply.deleteMany({ where: { id, brandId: membership.brandId } });
    if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[brand-kit/learned DELETE]", error);
    return NextResponse.json({ error: "Couldn't remove it" }, { status: 500 });
  }
}
