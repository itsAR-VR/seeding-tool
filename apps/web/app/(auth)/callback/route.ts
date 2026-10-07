import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";

/**
 * Supabase auth callback handler.
 * Handles email confirmation links, OAuth callbacks, and magic links.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/dashboard");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const otpType = type === "invite" || type === "magiclink" || type === "signup" || type === "email" ? type : null;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin;
  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url);
  };

  if (code || (tokenHash && otpType)) {
    const supabase = await createClient();
    // token_hash links come from our own invite emails (any browser works);
    // code links come from Supabase's PKCE flow (same browser only).
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType! });
    if (!error) return redirectTo(next);

    // One-time links fail when already used or expired. Send invite links back
    // to their invite, which explains that and offers a fresh link.
    if (next.startsWith("/invite/")) return redirectTo(next, { link: "expired" });
    return redirectTo("/login", { error: "link" });
  }

  return redirectTo("/login", { error: "auth" });
}
