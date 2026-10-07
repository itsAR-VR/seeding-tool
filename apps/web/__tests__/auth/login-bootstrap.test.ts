import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

import {
  LOGIN_BOOTSTRAP_ERROR_MESSAGE,
  LOGIN_UNCONFIRMED_MESSAGE,
  LOGIN_WRONG_PASSWORD_MESSAGE,
  friendlyLoginError,
  resolveLoginBootstrapOrgName,
  signInAndBootstrapLogin,
} from "@/app/(auth)/login/login-bootstrap";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "auth-user-123",
    email: "founder@kalm.test",
    user_metadata: { org_name: "Kalm" },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-14T00:00:00.000Z",
    ...overrides,
  } as User;
}

describe("login bootstrap recovery", () => {
  it("bootstraps the authenticated user before reporting login success", async () => {
    const user = makeUser();
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user },
      error: null,
    });
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const result = await signInAndBootstrapLogin({
      supabase: { auth: { signInWithPassword } },
      email: "typed@kalm.test",
      password: "password123",
      fetcher,
    });

    expect(result).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "typed@kalm.test",
      password: "password123",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/bootstrap",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          supabaseUserId: "auth-user-123",
          email: "founder@kalm.test",
          orgName: "Kalm",
        }),
      })
    );
  });

  it("returns a clear non-secret error when bootstrap fails", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "database unavailable" }), {
        status: 500,
      })
    );

    await expect(
      signInAndBootstrapLogin({
        supabase: { auth: { signInWithPassword } },
        email: "founder@kalm.test",
        password: "password123",
        fetcher,
      })
    ).resolves.toEqual({
      ok: false,
      error: LOGIN_BOOTSTRAP_ERROR_MESSAGE,
    });
  });

  it("explains a wrong password in plain words, without bootstrapping", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const fetcher = vi.fn();

    const result = await signInAndBootstrapLogin({
      supabase: { auth: { signInWithPassword } },
      email: "founder@kalm.test",
      password: "wrong-password",
      fetcher,
    });

    expect(result).toEqual({
      ok: false,
      error: LOGIN_WRONG_PASSWORD_MESSAGE,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to the authenticated email prefix when org metadata is missing", () => {
    expect(
      resolveLoginBootstrapOrgName(
        makeUser({ user_metadata: {}, email: "kamila@kalm.test" })
      )
    ).toBe("kamila");
  });

  it("tells an unconfirmed invitee to use their invite email", () => {
    expect(friendlyLoginError("Email not confirmed")).toBe(LOGIN_UNCONFIRMED_MESSAGE);
    expect(friendlyLoginError("Something else")).toBe("Something else");
  });
});
