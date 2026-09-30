import { NextRequest } from "next/server";
import { APP_URL } from "@/lib/config";
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
  subscribePageToWebhooks,
  getAdAccounts,
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
  const appUrl = APP_URL;
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

    // Collect every Page with a linked Instagram business account, then pick
    // the one that matches the brand's website (e.g. sleepkalm.com -> @sleepkalm)
    // so a user who manages several brands' Pages connects the right account.
    const candidates: Array<{
      igId: string;
      username: string | null;
      pageId: string;
      pageToken: string;
    }> = [];
    for (const page of pages.data) {
      const igAccount = await getInstagramAccountFromPage(page.id, longLivedToken.access_token);
      if (!igAccount) continue;
      let username: string | null = null;
      try {
        const profile = await getUserProfile(igAccount.id, page.access_token);
        username = profile.username ?? null;
      } catch {
        // Profile fetch is best-effort
      }
      candidates.push({ igId: igAccount.id, username, pageId: page.id, pageToken: page.access_token });
    }

    const brandRow = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { websiteUrl: true, name: true },
    });
    const siteStem = (() => {
      try {
        return brandRow?.websiteUrl
          ? new URL(brandRow.websiteUrl).hostname.replace(/^www\./, "").split(".")[0].toLowerCase()
          : null;
      } catch {
        return null;
      }
    })();
    const chosen =
      candidates.find((c) => siteStem && c.username?.toLowerCase() === siteStem) ??
      candidates.find((c) => siteStem && c.username?.toLowerCase().includes(siteStem)) ??
      candidates[0];

    const igAccountId: string | null = chosen?.igId ?? null;
    const igUsername: string | null = chosen?.username ?? null;

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

    // Pick the ad account for "Create ad": an active account whose name matches
    // the brand, else the first active one. Best-effort; ads are optional.
    const adAccounts = await getAdAccounts(longLivedToken.access_token).catch(() => []);
    const activeAccounts = adAccounts.filter((a) => a.account_status === 1);
    const brandWord = (brandRow?.name ?? siteStem ?? "").toLowerCase().split(/\s+/)[0];
    const adAccount =
      activeAccounts.find((a) => brandWord && a.name?.toLowerCase().includes(brandWord)) ??
      activeAccounts[0] ??
      null;

    // Step 4: Store encrypted credential + connection
    // Page tokens derived from a long-lived user token do not expire, so the
    // connection keeps working without the 60-day refresh.
    const credentialPayload = JSON.stringify({
      accessToken: chosen?.pageToken ?? longLivedToken.access_token,
      userAccessToken: longLivedToken.access_token,
      igUserId: igAccountId,
      igUsername,
      expiresIn: longLivedToken.expires_in,
      connectedAt: new Date().toISOString(),
    });

    const encryptedValue = encrypt(credentialPayload);

    // Long-lived user tokens last ~60 days; Meta omits expires_in for tokens
    // that never expire (the Page token we use for API calls never does).
    const expiresAt = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000)
      : null;

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
          pageId: chosen?.pageId ?? null,
          adAccountId: adAccount?.id ?? null,
          adAccountName: adAccount?.name ?? null,
        },
      });
    });

    // Story mentions and caption @mentions arrive as webhooks, which Meta only
    // sends for Pages subscribed to the app. Best-effort: the connection works without it.
    if (chosen) {
      await subscribePageToWebhooks(chosen.pageId, chosen.pageToken).catch((error) => {
        console.error("[instagram-callback] Page webhook subscription failed:", error);
      });
    }

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
