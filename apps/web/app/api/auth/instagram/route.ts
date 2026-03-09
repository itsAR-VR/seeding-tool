import { NextRequest } from "next/server";
import { assertBrandAccess, BrandAccessError } from "@/lib/integrations/brand-access";
import { encodeIntegrationOAuthState } from "@/lib/integrations/oauth-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Instagram OAuth — Step 1: Redirect to Facebook Login
 *
 * Uses Facebook Login for Business flow since Instagram Business/Creator
 * accounts are connected to Facebook Pages.
 *
 * Required scopes:
 * - instagram_basic: read IG profile + media
 * - instagram_manage_comments: read comments/mentions
 * - instagram_manage_insights: read media insights
 * - pages_show_list: list user's Pages
 * - pages_read_engagement: read Page engagement data
 * - pages_manage_metadata: manage Page metadata
 * - business_management: manage business settings
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.redirect(`${appUrl}/login`);
  }

  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId");
  const returnTo = searchParams.get("returnTo") ?? undefined;

  if (!brandId) {
    return new Response("Missing brandId parameter", { status: 400 });
  }

  try {
    await assertBrandAccess(brandId, { requireAdmin: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return new Response(error.message, { status: error.status });
    }

    return new Response("Forbidden", { status: 403 });
  }

  const appId = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return new Response("Instagram OAuth not configured", { status: 500 });
  }

  const scopes = [
    "instagram_basic",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "business_management",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${appUrl}/api/auth/instagram/callback`,
    response_type: "code",
    scope: scopes,
    state: encodeIntegrationOAuthState({ brandId, returnTo }),
  });

  return Response.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params}`
  );
}
