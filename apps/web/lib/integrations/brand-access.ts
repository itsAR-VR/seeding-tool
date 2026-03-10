import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type AccessOptions = {
  requireAdmin?: boolean;
};

export class BrandAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function assertAdminRole(role: string | null | undefined) {
  return role === "owner" || role === "editor";
}

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

export async function getCurrentBrandMembership(
  options: AccessOptions = {}
) {
  const user = await getCurrentUserRecord();

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new BrandAccessError("No brand found", 404);
  }

  if (options.requireAdmin && !assertAdminRole(membership.role)) {
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

  if (options.requireAdmin && !assertAdminRole(membership.role)) {
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

  if (options.requireAdmin && !assertAdminRole(membership?.role)) {
    throw new BrandAccessError("Admin access required", 403);
  }

  return {
    id: campaign.id,
    brandId: campaign.brandId,
  };
}
