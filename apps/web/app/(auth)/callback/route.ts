import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Supabase auth callback handler.
 * Handles email confirmation links, OAuth callbacks, and magic links.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths: "//x" or "@x" would send people to another site.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/dashboard";

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const otpType = type === "invite" || type === "magiclink" || type === "signup" || type === "email" ? type : null;

  if (code || (tokenHash && otpType)) {
    const supabase = await createClient();
    // token_hash links come from our own invite emails (any browser works);
    // code links come from Supabase's PKCE flow (same browser only).
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType! });
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Auth error — redirect to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
