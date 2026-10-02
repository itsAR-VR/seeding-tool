import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOrgForUser } from "@/lib/tenancy";

/** Same cookie lib/integrations/brand-access.ts reads to pick the active company. */
export const ACTIVE_BRAND_COOKIE = "seed-active-brand";

/**
 * The one rule for "this company is still being set up", shared by the
 * onboarding routes and the Home gate so they can never disagree (which is
 * what causes /dashboard <-> /onboarding redirect loops).
 *
 * A brand is in setup when this user owns it, it was created in their own
 * organization (by the onboarding wizard), and its onboarding row says it isn't
 * finished. Brands with no onboarding row (older or admin-made companies) and
 * companies someone was invited into are never "in setup" for this user.
 */
function inSetupWhere(userId: string, organizationId: string) {
  return {
    userId,
    role: "owner",
    brand: { client: { organizationId }, onboarding: { isComplete: false } },
  };
}

export type BrandInSetup = { id: string; name: string; websiteUrl: string | null };

/** The newest company this user is still setting up, or null. */
export async function findBrandInSetup(userId: string): Promise<BrandInSetup | null> {
  const org = await getOrgForUser(userId);
  if (!org) return null;
  const membership = await prisma.brandMembership.findFirst({
    where: inSetupWhere(userId, org.id),
    include: { brand: { select: { id: true, name: true, websiteUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return membership?.brand ?? null;
}

/** Whether this specific company is one the user still has to set up. */
export async function isBrandInSetup(userId: string, brandId: string): Promise<boolean> {
  const org = await getOrgForUser(userId);
  if (!org) return false;
  const membership = await prisma.brandMembership.findFirst({
    where: { ...inSetupWhere(userId, org.id), brandId },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * The company the user is looking at: the active-brand cookie when they still
 * belong to it, otherwise their oldest company. A stale cookie (removed from
 * that team) falls back instead of failing, so Home never bounces to setup.
 */
export async function getActiveMembership(userId: string) {
  const cookieBrandId = (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value;
  if (cookieBrandId) {
    const fromCookie = await prisma.brandMembership.findUnique({
      where: { userId_brandId: { userId, brandId: cookieBrandId } },
    });
    if (fromCookie) return fromCookie;
  }
  return prisma.brandMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** Point the rest of the app (brand kit, connections, Home) at this company. */
export async function setActiveBrandCookie(brandId: string) {
  (await cookies()).set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
