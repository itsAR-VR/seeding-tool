import type { User as AuthUser } from "@supabase/supabase-js";
import type { BrandInvite, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bootstrapNewUser, getUserBySupabaseId } from "@/lib/tenancy";

/**
 * The app user for a confirmed Supabase login: matched by login id, then by
 * email (an app user whose login was recreated gets relinked rather than
 * failing on the unique email), and created when there is none.
 */
export async function ensureAppUser(authUserId: string, email: string, orgName: string): Promise<User> {
  const bySupabaseId = await getUserBySupabaseId(authUserId);
  if (bySupabaseId) return bySupabaseId;

  const byEmail = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (byEmail) return prisma.user.update({ where: { id: byEmail.id }, data: { supabaseId: authUserId } });

  return (await bootstrapNewUser(authUserId, email, orgName)).user;
}

type JoinableInvite = Pick<BrandInvite, "id" | "email" | "role" | "brandId" | "companyName">;

/**
 * Use up an invite for this confirmed login: claim it (so two tabs can't both
 * use it), make sure the app user exists, and add them to the company for a
 * teammate invite. Returns null when someone else already claimed it. If
 * joining fails the invite is given back so the link still works.
 */
export async function joinInvite(invite: JoinableInvite, authUserId: string): Promise<User | null> {
  const claimed = await prisma.brandInvite.updateMany({
    where: { id: invite.id, acceptedAt: null, revokedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  try {
    const user = await ensureAppUser(authUserId, invite.email, invite.companyName ?? invite.email.split("@")[0]);
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

  return (await joinInvite(invite, authUser.id)) ?? getUserBySupabaseId(authUser.id);
}
