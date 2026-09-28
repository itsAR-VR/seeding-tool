import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { archiveContentPost } from "@/lib/content/archive";

// Saving a copy of an approved video can take a few seconds.
export const maxDuration = 60;

/**
 * POST /api/rights/:token — public endpoint where a creator approves or
 * declines a usage-rights request.
 * Body: { decision: "approve" | "decline", name?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    decision?: unknown;
    name?: unknown;
  };
  const decision = body.decision;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";

  if (decision !== "approve" && decision !== "decline") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }
  if (decision === "approve" && name.length < 2) {
    return NextResponse.json({ error: "Please type your full name" }, { status: 400 });
  }

  const post = await prisma.contentPost.findUnique({ where: { rightsToken: token } });
  if (!post || post.rightsStatus !== "requested") {
    return NextResponse.json({ error: "This link is no longer active" }, { status: 410 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.contentPost.update({
    where: { id: post.id },
    data: {
      rightsStatus: decision === "approve" ? "approved" : "declined",
      rightsRespondedAt: new Date(),
      rightsSignerName: decision === "approve" ? name : null,
      rightsSignerIp: ip,
    },
  });

  if (decision === "approve") {
    await archiveContentPost(post.id).catch((error) =>
      console.error("[rights] Could not save a copy of the post:", error)
    );
  }

  return NextResponse.json({ ok: true });
}
