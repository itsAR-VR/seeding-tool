import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { bootstrapNewUser, getUserBySupabaseId } from "@/lib/tenancy";

/**
 * The app user for a signed-in Supabase login. Someone who signed in through
 * their invite email but closed the page before pressing "Accept invite" has a
 * confirmed login and no app user yet; their open invite is accepted for them
 * here, since a confirmed session for that email is the same proof the accept
 * step checks. Returns null for anyone without an invite.
 */
export async function getOrAcceptInvitedUser(authUser: AuthUser) {
  const existing = await getUserBySupabaseId(authUser.id);
  if (existing) return existing;

  const email = authUser.email?.toLowerCase().trim();
  if (!email || !authUser.email_confirmed_at) return null;

  const invite = await prisma.brandInvite.findFirst({
    where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!invite) return null;

  const claimed = await prisma.brandInvite.updateMany({
    where: { id: invite.id, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count === 0) return getUserBySupabaseId(authUser.id);

  try {
    const { user } = await bootstrapNewUser(authUser.id, email, invite.companyName ?? email.split("@")[0]);
    if (invite.brandId) {
      await prisma.brandMembership.upsert({
        where: { userId_brandId: { userId: user.id, brandId: invite.brandId } },
        update: {},
        create: { userId: user.id, brandId: invite.brandId, role: invite.role },
      });
    }
    return user;
  } catch (error) {
    await prisma.brandInvite.update({ where: { id: invite.id }, data: { acceptedAt: null } });
    throw error;
  }
}
