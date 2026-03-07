import { prisma } from "@/lib/prisma";

/**
 * Fetch the active organization for a user (by their internal Prisma user id).
 * Returns the first org membership found. In the future this can respect
 * a "last active org" preference stored on the user row.
 */
export async function getOrgForUser(userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return membership?.organization ?? null;
}

/**
 * Fetch org or throw — intended for server components / actions that
 * require an active organization context.
 */
export async function requireOrg(userId: string) {
  const org = await getOrgForUser(userId);
  if (!org) {
    throw new Error("NO_ORGANIZATION");
  }
  return org;
}

/**
 * Create a User + Organization + Membership in a single transaction.
 * Called during signup after Supabase has issued a user record.
 */
export async function bootstrapNewUser(
  supabaseUserId: string,
  email: string,
  orgName: string
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        supabaseId: supabaseUserId,
        email,
      },
    });

    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug: slugify(orgName),
      },
    });

    await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      },
    });

    return { user, org };
  });
}

/**
 * Look up internal user by Supabase auth id.
 */
export async function getUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({ where: { supabaseId } });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
