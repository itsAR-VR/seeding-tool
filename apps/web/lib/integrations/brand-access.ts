import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

// ── Constants ───────────────────────────────────────────────

const BRAND_COOKIE_NAME = "seed-active-brand";

// ── Types ───────────────────────────────────────────────────

type AccessOptions = {
  requireAdmin?: boolean;
};

type BrandMembershipRecord = {
  id: string;
  role: string;
  userId: string;
  brandId: string;
  createdAt: Date;
  updatedAt: Date;
};

// ── Error ───────────────────────────────────────────────────

export class BrandAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// ── Role helpers (allowlist pattern) ────────────────────────

/**
 * Returns true if the role has admin-level access (owner or editor).
 * Uses allowlist — unknown role values are denied.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

/**
 * Throws if the membership role is not owner or editor.
 * Use for routes that modify data (POST, PUT, PATCH, DELETE).
 */
export function requireWriteAccess(
  membership: BrandMembershipRecord
): BrandMembershipRecord {
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new BrandAccessError("Write access required", 403);
  }
  return membership;
}

/**
 * Throws if the membership role is not owner or editor.
 * Use for admin settings routes (feature flags, approval config).
 */
export function requireAdminAccess(
  membership: BrandMembershipRecord
): BrandMembershipRecord {
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new BrandAccessError("Admin access required", 403);
  }
  return membership;
}

/**
 * Throws if the membership role is not owner.
 * Use for destructive/billing operations (brand rename, checkout).
 */
export function requireOwnerAccess(
  membership: BrandMembershipRecord
): BrandMembershipRecord {
  if (membership.role !== "owner") {
    throw new BrandAccessError("Owner access required", 403);
  }
  return membership;
}

// ── Auth helpers ────────────────────────────────────────────

async function getCurrentUserRecord() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new BrandAccessError("Unauthorized", 401);
  }

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) {
    throw new BrandAccessError("User not found", 404);
  }

  return user;
}

// ── Brand membership resolution ─────────────────────────────

/**
 * Resolves the current user's brand membership.
 *
 * Resolution order:
 * 1. If `seed-active-brand` cookie is set, look up membership for that brand.
 * 2. Otherwise, fall back to the user's oldest brand (backward compat).
 *
 * Uses cookies (not headers) so RSC pages can also resolve the brand.
 */
export async function getCurrentBrandMembership(
  options: AccessOptions = {}
) {
  const user = await getCurrentUserRecord();

  const cookieStore = await cookies();
  const brandId = cookieStore.get(BRAND_COOKIE_NAME)?.value;

  const membership = brandId
    ? await prisma.brandMembership.findUnique({
        where: { userId_brandId: { userId: user.id, brandId } },
      })
    : await prisma.brandMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

  if (!membership) {
    throw new BrandAccessError("No brand found", 404);
  }

  if (options.requireAdmin && !isAdminRole(membership.role)) {
    throw new BrandAccessError("Admin access required", 403);
  }

  return membership;
}

export async function assertBrandAccess(
  brandId: string,
  options: AccessOptions = {}
) {
  const user = await getCurrentUserRecord();

  const membership = await prisma.brandMembership.findUnique({
    where: {
      userId_brandId: { userId: user.id, brandId },
    },
  });

  if (!membership) {
    throw new BrandAccessError("Forbidden", 403);
  }

  if (options.requireAdmin && !isAdminRole(membership.role)) {
    throw new BrandAccessError("Admin access required", 403);
  }

  return membership;
}

export async function getAuthorizedCampaign(
  campaignId: string,
  options: AccessOptions = {}
) {
  const user = await getCurrentUserRecord();

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      brand: {
        memberships: {
          some: {
            userId: user.id,
          },
        },
      },
    },
    select: {
      id: true,
      brandId: true,
      brand: {
        select: {
          memberships: {
            where: { userId: user.id },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new BrandAccessError("Campaign not found", 404);
  }

  const membership = campaign.brand.memberships[0];

  if (options.requireAdmin && !isAdminRole(membership?.role)) {
    throw new BrandAccessError("Admin access required", 403);
  }

  return {
    id: campaign.id,
    brandId: campaign.brandId,
  };
}
