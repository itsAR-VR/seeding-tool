import { NextRequest } from "next/server";
import { encrypt } from "@/lib/encryption";
import { assertBrandAccess, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  buildConnectionRedirect,
  decodeIntegrationOAuthState,
} from "@/lib/integrations/oauth-state";
import { upsertBrandConnection, upsertProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";
import {
  exchangeForLongLivedToken,
  getUserPages,
  getInstagramAccountFromPage,
  getUserProfile,
} from "@/lib/instagram/client";

/**
 * Instagram OAuth — Step 2: Handle callback
 *
 * Exchanges the code for an access token, then:
 * 1. Exchange short-lived token for long-lived token
 * 2. Find the user's Facebook Pages
 * 3. Find the Instagram Business Account connected to a Page
 * 4. Store encrypted credentials as ProviderCredential
 * 5. Create BrandConnection
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let state: ReturnType<typeof decodeIntegrationOAuthState> | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    state = decodeIntegrationOAuthState(searchParams.get("state"));
    const brandId = state?.brandId ?? null;
    const error = searchParams.get("error");

    if (error) {
      console.error("[instagram-callback] OAuth error:", error);
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "oauth_denied",
        })
      );
    }

    if (!code || !brandId) {
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "missing_params",
        })
      );
    }

    try {
      await assertBrandAccess(brandId, { requireAdmin: true });
    } catch (accessError) {
      if (accessError instanceof BrandAccessError && accessError.status === 401) {
        return Response.redirect(`${appUrl}/login`);
      }
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "forbidden",
        })
      );
    }

    const appId = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("[instagram-callback] Missing META_APP_ID or INSTAGRAM_APP_SECRET");
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "internal",
        })
      );
    }

    // Step 1: Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: `${appUrl}/api/auth/instagram/callback`,
      code,
    });

    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[instagram-callback] Token exchange failed:", errBody);
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "token_exchange",
        })
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
    };

    // Step 2: Exchange for long-lived token (60-day validity)
    const longLivedToken = await exchangeForLongLivedToken(
      tokenData.access_token,
      appId,
      appSecret
    );

    // Step 3: Find user's Pages and linked Instagram accounts
    const pages = await getUserPages(longLivedToken.access_token);

    let igAccountId: string | null = null;
    let igUsername: string | null = null;

    for (const page of pages.data) {
      const igAccount = await getInstagramAccountFromPage(
        page.id,
        longLivedToken.access_token
      );

      if (igAccount) {
        igAccountId = igAccount.id;

        // Fetch the IG username
        try {
          const profile = await getUserProfile(
            igAccount.id,
            longLivedToken.access_token
          );
          igUsername = profile.username ?? null;
        } catch {
          // Profile fetch is best-effort
        }

        break; // Use the first linked IG account
      }
    }

    if (!igAccountId) {
      console.error(
        "[instagram-callback] No Instagram Business Account found on any Page"
      );
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "no_instagram_account",
        })
      );
    }

    // Step 4: Store encrypted credential + connection
    const credentialPayload = JSON.stringify({
      accessToken: longLivedToken.access_token,
      igUserId: igAccountId,
      igUsername,
      expiresIn: longLivedToken.expires_in,
      connectedAt: new Date().toISOString(),
    });

    const encryptedValue = encrypt(credentialPayload);

    // Calculate expiry (long-lived tokens last ~60 days)
    const expiresAt = new Date(
      Date.now() + longLivedToken.expires_in * 1000
    );

    await prisma.$transaction(async (tx) => {
      await upsertProviderCredential(tx, {
        brandId,
        provider: "instagram",
        label: igUsername ?? igAccountId,
        encryptedValue,
        credentialType: "oauth_access_token",
        expiresAt,
      });

      await upsertBrandConnection(tx, {
        brandId,
        provider: "instagram",
        status: "connected",
        connectionMethod: "oauth",
        externalId: igUsername ?? igAccountId,
        metadata: {
          igUserId: igAccountId,
          igUsername,
        },
      });
    });

    return Response.redirect(
      buildConnectionRedirect(appUrl, state?.returnTo, {
        connected: "instagram",
      })
    );
  } catch (error) {
    console.error("[instagram-callback] Error:", error);
    return Response.redirect(
      buildConnectionRedirect(appUrl, state?.returnTo, {
        error: "internal",
      })
    );
  }
}
