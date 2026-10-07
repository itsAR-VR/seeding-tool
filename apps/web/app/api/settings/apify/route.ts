import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";
import { resolveApifyToken } from "@/lib/apify/token";

/**
 * How much of this month's search allowance is left, as a whole percent.
 * A percent (not dollars) so a company on the shared account never sees our
 * spending. Null when Apify can't say, which is never a reason to fail the page.
 */
async function allowance(brandId: string): Promise<{ leftPercent: number; resetsAt: string | null } | null> {
  try {
    const token = await resolveApifyToken(brandId);
    const res = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        monthlyUsageCycle?: { endAt?: string };
        limits?: { maxMonthlyUsageUsd?: number };
        current?: { monthlyUsageUsd?: number };
      };
    };
    const limit = body.data?.limits?.maxMonthlyUsageUsd;
    const used = body.data?.current?.monthlyUsageUsd;
    if (!limit || used == null) return null;
    return {
      leftPercent: Math.max(0, Math.min(100, Math.floor(((limit - used) / limit) * 100))),
      resetsAt: body.data?.monthlyUsageCycle?.endAt ?? null,
    };
  } catch {
    return null;
  }
}

/** GET /api/settings/apify — which Apify account this company's searches use. */
export async function GET() {
  try {
    const { brandId } = await getCurrentBrandMembership();
    const brand = await prisma.brand.findUniqueOrThrow({
      where: { id: brandId },
      select: { apifyTokenEnc: true, useSharedApify: true },
    });
    const ready = Boolean(brand.apifyTokenEnc) || brand.useSharedApify;
    return NextResponse.json({
      hasOwnKey: Boolean(brand.apifyTokenEnc),
      usesShared: brand.useSharedApify,
      ...(await (async () => {
        const a = ready ? await allowance(brandId) : null;
        return { allowanceLeftPercent: a?.leftPercent ?? null, allowanceResetsAt: a?.resetsAt ?? null };
      })()),
    });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[settings/apify GET]", error);
    return NextResponse.json({ error: "Couldn't load this" }, { status: 500 });
  }
}

/** PUT /api/settings/apify — save the company's own Apify key. Body: { token } */
export async function PUT(request: Request) {
  try {
    const membership = requireAdminAccess(await getCurrentBrandMembership());
    const body = (await request.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^apify_api_[A-Za-z0-9]{20,}$/.test(token)) {
      return NextResponse.json({ error: "That doesn't look like an Apify API key. It starts with apify_api_." }, { status: 400 });
    }
    // Check the key works before saving it.
    const check = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!check.ok) {
      return NextResponse.json({ error: "Apify didn't accept that key. Copy it again from Apify > Settings > API." }, { status: 400 });
    }
    await prisma.brand.update({ where: { id: membership.brandId }, data: { apifyTokenEnc: encrypt(token) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[settings/apify PUT]", error);
    return NextResponse.json({ error: "Couldn't save the key" }, { status: 500 });
  }
}

/** DELETE /api/settings/apify — remove the company's own key. */
export async function DELETE() {
  try {
    const membership = requireAdminAccess(await getCurrentBrandMembership());
    await prisma.brand.update({ where: { id: membership.brandId }, data: { apifyTokenEnc: null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[settings/apify DELETE]", error);
    return NextResponse.json({ error: "Couldn't remove the key" }, { status: 500 });
  }
}
