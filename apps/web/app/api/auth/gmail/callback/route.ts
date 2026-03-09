import { NextRequest } from "next/server";
import { encrypt } from "@/lib/encryption";
import { assertBrandAccess, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  buildConnectionRedirect,
  decodeIntegrationOAuthState,
} from "@/lib/integrations/oauth-state";
import { upsertBrandConnection, upsertProviderCredential } from "@/lib/integrations/state";
import { prisma } from "@/lib/prisma";

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
      console.error("[gmail-callback] OAuth error:", error);
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

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("[gmail-callback] Token exchange failed:", errBody);
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "token_exchange",
        })
      );
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    if (!tokens.refresh_token) {
      console.error("[gmail-callback] No refresh token returned");
      return Response.redirect(
        buildConnectionRedirect(appUrl, state?.returnTo, {
          error: "no_refresh_token",
        })
      );
    }

    // Get the user's email address from Google
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    let emailAddress = "unknown";
    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as { email?: string };
      if (profile.email) {
        emailAddress = profile.email;
      }
    }

    // Encrypt the refresh token before storing
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Store credential and connection in a transaction
    await prisma.$transaction(async (tx) => {
      await upsertProviderCredential(tx, {
        brandId,
        provider: "gmail",
        label: emailAddress,
        encryptedValue: encryptedRefreshToken,
        credentialType: "oauth_refresh_token",
      });

      await upsertBrandConnection(tx, {
        brandId,
        provider: "gmail",
        status: "connected",
        connectionMethod: "oauth",
        externalId: emailAddress,
      });

      // Newest connected Gmail becomes the primary sender for this phase.
      await tx.emailAlias.updateMany({
        where: { brandId },
        data: { isPrimary: false },
      });

      await tx.emailAlias.upsert({
        where: {
          brandId_address: { brandId, address: emailAddress },
        },
        create: {
          brandId,
          address: emailAddress,
          displayName: emailAddress.split("@")[0],
          isPrimary: true,
        },
        update: {
          displayName: emailAddress.split("@")[0],
          isPrimary: true,
        },
      });
    });

    return Response.redirect(
      buildConnectionRedirect(appUrl, state?.returnTo, {
        connected: "gmail",
      })
    );
  } catch (error) {
    console.error("[gmail-callback] Error:", error);
    return Response.redirect(
      buildConnectionRedirect(appUrl, state?.returnTo, {
        error: "internal",
      })
    );
  }
}
