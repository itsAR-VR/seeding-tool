import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Approval settings API — controls how the AI-driven creator discovery
 * pipeline handles approval decisions.
 *
 * Stored in BrandSettings.metadata.approvalMode and .approvalThreshold.
 *
 * Modes:
 *   "auto"      — AI decision is final (approve/decline written immediately).
 *                 Higher throughput but no human in the loop.
 *   "recommend" — AI scores creators but all land in pending queue.
 *                 Human reviews InterventionCases before creators advance.
 *                 Safer for live/production rollouts.
 *
 * Threshold:
 *   0-1 float. Creators at or above threshold are considered approved by the AI.
 *   Defaults to 0.75. Raise to reduce false-positives; lower for more coverage.
 */

const DEFAULT_APPROVAL_MODE = "recommend" as const;
const DEFAULT_APPROVAL_THRESHOLD = 0.75;

interface ApprovalSettings {
  approvalMode: "auto" | "recommend";
  approvalThreshold: number;
}

async function getApprovalSettings(brandId: string): Promise<ApprovalSettings> {
  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
    select: { metadata: true },
  });

  const meta = (settings?.metadata ?? {}) as Record<string, unknown>;

  const mode = meta.approvalMode === "auto" ? "auto" : DEFAULT_APPROVAL_MODE;

  let threshold = DEFAULT_APPROVAL_THRESHOLD;
  const raw = meta.approvalThreshold;
  if (typeof raw === "number" && raw > 0 && raw <= 1) {
    threshold = raw;
  } else if (typeof raw === "string") {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1) threshold = parsed;
  }

  return { approvalMode: mode, approvalThreshold: threshold };
}

async function getBrandMembership(authUserId: string) {
  const user = await getUserBySupabaseId(authUserId);
  if (!user) return null;

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return membership;
}

/**
 * GET /api/settings/approval
 * Returns current approval settings for the brand.
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

    const membership = await getBrandMembership(authUser.id);
    if (!membership) {
      return NextResponse.json({ error: "No brand access" }, { status: 403 });
    }

    const settings = await getApprovalSettings(membership.brandId);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[approval] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/approval
 * Body: { approvalMode?: "auto" | "recommend", approvalThreshold?: number }
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

    const membership = await getBrandMembership(authUser.id);
    if (!membership) {
      return NextResponse.json({ error: "No brand access" }, { status: 403 });
    }

    if (membership.role !== "owner" && membership.role !== "editor") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as {
      approvalMode?: string;
      approvalThreshold?: number;
    };

    // Validate
    if (
      body.approvalMode !== undefined &&
      body.approvalMode !== "auto" &&
      body.approvalMode !== "recommend"
    ) {
      return NextResponse.json(
        { error: "approvalMode must be 'auto' or 'recommend'" },
        { status: 400 }
      );
    }

    if (body.approvalThreshold !== undefined) {
      const t = Number(body.approvalThreshold);
      if (isNaN(t) || t <= 0 || t > 1) {
        return NextResponse.json(
          { error: "approvalThreshold must be a number between 0.01 and 1.0" },
          { status: 400 }
        );
      }
    }

    // Read existing metadata, merge changes
    const existingSettings = await prisma.brandSettings.findUnique({
      where: { brandId: membership.brandId },
      select: { metadata: true },
    });

    const currentMeta = (existingSettings?.metadata ?? {}) as Record<string, unknown>;
    const updatedMeta: Record<string, unknown> = { ...currentMeta };

    if (body.approvalMode !== undefined) {
      updatedMeta.approvalMode = body.approvalMode;
    }
    if (body.approvalThreshold !== undefined) {
      updatedMeta.approvalThreshold = Number(body.approvalThreshold);
    }

    await prisma.brandSettings.upsert({
      where: { brandId: membership.brandId },
      create: {
        brandId: membership.brandId,
        metadata: updatedMeta as Prisma.InputJsonValue,
      },
      update: {
        metadata: updatedMeta as Prisma.InputJsonValue,
      },
    });

    const updated = await getApprovalSettings(membership.brandId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[approval] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
