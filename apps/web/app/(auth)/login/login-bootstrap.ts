import type { User } from "@supabase/supabase-js";

export const LOGIN_BOOTSTRAP_ERROR_MESSAGE =
  "We signed you in, but couldn't finish preparing your workspace. Please try again.";

export const LOGIN_USER_CONFIRMATION_ERROR_MESSAGE =
  "We couldn't confirm your login details. Please try again.";

type LoginSupabaseClient = {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{
      data?: { user: User | null } | null;
      error?: { message: string } | null;
    }>;
  };
};

type LoginBootstrapResult =
  | { ok: true }
  | { ok: false; error: string };

type Fetcher = typeof fetch;

export function resolveLoginBootstrapOrgName(user: User): string {
  const metadataOrgName = user.user_metadata?.org_name;
  if (typeof metadataOrgName === "string" && metadataOrgName.trim()) {
    return metadataOrgName.trim();
  }

  return user.email?.split("@")[0]?.trim() || "workspace";
}

export async function bootstrapLoginUser(
  user: User,
  fetcher: Fetcher = fetch
) {
  if (!user.id || !user.email) {
    throw new Error(LOGIN_USER_CONFIRMATION_ERROR_MESSAGE);
  }

  const response = await fetcher("/api/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      supabaseUserId: user.id,
      email: user.email,
      orgName: resolveLoginBootstrapOrgName(user),
    }),
  });

  if (!response.ok) {
    throw new Error(LOGIN_BOOTSTRAP_ERROR_MESSAGE);
  }
}

export async function signInAndBootstrapLogin({
  supabase,
  email,
  password,
  fetcher,
}: {
  supabase: LoginSupabaseClient;
  email: string;
  password: string;
  fetcher?: Fetcher;
}): Promise<LoginBootstrapResult> {
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { ok: false, error: authError.message };
  }

  if (!data?.user) {
    return { ok: false, error: LOGIN_USER_CONFIRMATION_ERROR_MESSAGE };
  }

  try {
    await bootstrapLoginUser(data.user, fetcher);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : LOGIN_BOOTSTRAP_ERROR_MESSAGE,
    };
  }

  return { ok: true };
}
