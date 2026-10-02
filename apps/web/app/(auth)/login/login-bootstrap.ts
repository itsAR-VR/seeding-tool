import type { User } from "@supabase/supabase-js";

export const LOGIN_BOOTSTRAP_ERROR_MESSAGE =
  "We signed you in, but couldn't finish preparing your workspace. Please try again.";

export const LOGIN_USER_CONFIRMATION_ERROR_MESSAGE =
  "We couldn't confirm your login details. Please try again.";

export const LOGIN_WRONG_PASSWORD_MESSAGE =
  "That email and password don't match. If you joined from an invite and never set a password, open your invite email and use its link to get a sign-in link.";

export const LOGIN_UNCONFIRMED_MESSAGE =
  "This email isn't confirmed yet. Open your invite email and use its link to finish joining.";

/** Supabase's sign-in errors, in plain words with what to do next. */
export function friendlyLoginError(message: string): string {
  if (/invalid login credentials/i.test(message)) return LOGIN_WRONG_PASSWORD_MESSAGE;
  if (/email not confirmed/i.test(message)) return LOGIN_UNCONFIRMED_MESSAGE;
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a minute, then try again.";
  return message;
}

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
    return { ok: false, error: friendlyLoginError(authError.message) };
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
