import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";
import { DEFAULT_FOLLOW_UP_TEMPLATE } from "@/lib/brand/kit";

const TEXT_FIELDS = [
  "senderFirstName",
  "brandDescription",
  "productFacts",
  "replyExamples",
  "followUpTemplate",
  "adDefaultText",
  "adDefaultHeadline",
  "adDefaultLink",
] as const;

const SELECT = {
  name: true,
  websiteUrl: true,
  logoUrl: true,
  shipCountries: true,
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, true])),
} as const;

/** GET /api/brand-kit — this company's brand kit. */
export async function GET() {
  try {
    const { brandId } = await getCurrentBrandMembership();
    const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: SELECT });
    return NextResponse.json({ ...brand, defaultFollowUp: DEFAULT_FOLLOW_UP_TEMPLATE });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[brand-kit GET]", error);
    return NextResponse.json({ error: "Couldn't load the brand kit" }, { status: 500 });
  }
}

/** PATCH /api/brand-kit — save any of the text fields and ship countries. */
export async function PATCH(request: Request) {
  try {
    const { brandId } = requireAdminAccess(await getCurrentBrandMembership());
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const field of TEXT_FIELDS) {
      if (typeof body[field] === "string") {
        const value = (body[field] as string).trim();
        data[field] = value ? value.slice(0, 20000) : null;
      }
    }
    if (typeof data.adDefaultLink === "string" && !/^https:\/\//.test(data.adDefaultLink)) {
      return NextResponse.json({ error: "The ad link must start with https://" }, { status: 400 });
    }
    if (Array.isArray(body.shipCountries)) {
      const codes = (body.shipCountries as unknown[])
        .filter((c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c.trim().toUpperCase()))
        .map((c) => c.trim().toUpperCase());
      if (codes.length === 0) return NextResponse.json({ error: "Pick at least one country." }, { status: 400 });
      data.shipCountries = [...new Set(codes)];
    }
    await prisma.brand.update({ where: { id: brandId }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[brand-kit PATCH]", error);
    return NextResponse.json({ error: "Couldn't save the brand kit" }, { status: 500 });
  }
}
