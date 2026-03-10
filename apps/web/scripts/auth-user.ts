import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { prisma } from "../lib/prisma";

type Command = "status" | "confirm" | "delete";

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: { org_name?: string | null } | null;
};

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey);
}

async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const supabase = await getAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match as AuthUser;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function getAppUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    include: {
      organizationMemberships: {
        include: { organization: true },
      },
    },
  });
}

async function ensureWorkspace(authUser: AuthUser, orgNameOverride?: string) {
  const email = authUser.email;
  if (!email) {
    throw new Error("Auth user is missing email");
  }

  const existing = await getAppUserBySupabaseId(authUser.id);
  if (existing) {
    return existing;
  }

  const baseOrgName =
    orgNameOverride?.trim() ||
    authUser.user_metadata?.org_name?.trim() ||
    email.split("@")[0];

  let slug = slugify(baseOrgName);
  if (!slug) {
    slug = `workspace-${authUser.id.slice(0, 8)}`;
  }

  let candidate = slug;
  let counter = 2;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        supabaseId: authUser.id,
        email,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: baseOrgName,
        slug: candidate,
      },
    });

    await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      },
    });

    return { user, organization };
  });

  return {
    ...result.user,
    organizationMemberships: [
      {
        organization: result.organization,
      },
    ],
  };
}

async function printStatus(email: string) {
  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    console.log(JSON.stringify({ email, authUser: null, appUser: null }, null, 2));
    return;
  }

  const appUser = await getAppUserBySupabaseId(authUser.id);
  console.log(
    JSON.stringify(
      {
        authUser: {
          id: authUser.id,
          email: authUser.email,
          emailConfirmedAt: authUser.email_confirmed_at ?? null,
          orgName: authUser.user_metadata?.org_name ?? null,
        },
        appUser: appUser
          ? {
              id: appUser.id,
              email: appUser.email,
              organizations: appUser.organizationMemberships.map((membership) => ({
                id: membership.organization.id,
                name: membership.organization.name,
                slug: membership.organization.slug,
              })),
            }
          : null,
      },
      null,
      2
    )
  );
}

async function confirmUser(email: string, orgNameOverride?: string) {
  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    throw new Error(`No auth user found for ${email}`);
  }

  const supabase = await getAdminClient();
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  const appUser = await ensureWorkspace(
    {
      ...authUser,
      email_confirmed_at: data.user?.email_confirmed_at ?? authUser.email_confirmed_at,
    },
    orgNameOverride
  );

  console.log(
    JSON.stringify(
      {
        action: "confirm",
        authUserId: authUser.id,
        email,
        emailConfirmedAt: data.user?.email_confirmed_at ?? null,
        appUserId: appUser.id,
      },
      null,
      2
    )
  );
}

async function deleteUser(email: string, force = false) {
  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    throw new Error(`No auth user found for ${email}`);
  }

  const appUser = await getAppUserBySupabaseId(authUser.id);
  if (appUser && !force) {
    throw new Error(
      `Refusing to delete auth user ${email} because an app user exists. Re-run with --force if that is intentional.`
    );
  }

  const supabase = await getAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(authUser.id);
  if (error) {
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        action: "delete",
        authUserId: authUser.id,
        email,
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2] as Command | undefined;
  const email = getArg("--email");
  const orgName = getArg("--org");

  if (!command || !email || !["status", "confirm", "delete"].includes(command)) {
    console.error(
      [
        "Usage:",
        "  npm run web:auth-user -- status --email you@example.com",
        "  npm run web:auth-user -- confirm --email you@example.com [--org \"Workspace Name\"]",
        "  npm run web:auth-user -- delete --email you@example.com [--force]",
      ].join("\n")
    );
    process.exit(1);
  }

  if (command === "status") {
    await printStatus(email);
    return;
  }

  if (command === "confirm") {
    await confirmUser(email, orgName);
    return;
  }

  await deleteUser(email, hasFlag("--force"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
