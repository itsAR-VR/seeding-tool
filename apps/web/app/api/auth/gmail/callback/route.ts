import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const brandId = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("[gmail-callback] OAuth error:", error);
      return Response.redirect(
        `${appUrl}/settings/connections?error=oauth_denied`
      );
    }

    if (!code || !brandId) {
      return Response.redirect(
        `${appUrl}/settings/connections?error=missing_params`
      );
    }

    // Verify auth
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return Response.redirect(`${appUrl}/login`);
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return Response.redirect(`${appUrl}/login`);
    }

    // Verify brand access
    const membership = await prisma.brandMembership.findUnique({
      where: {
        userId_brandId: { userId: user.id, brandId },
      },
    });

    if (!membership) {
      return Response.redirect(
        `${appUrl}/settings/connections?error=forbidden`
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
        `${appUrl}/settings/connections?error=token_exchange`
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
        `${appUrl}/settings/connections?error=no_refresh_token`
      );
    }

    // Get the user's email address from Google
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    let emailAddress = authUser.email ?? "unknown";
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
      // Upsert provider credential
      await tx.providerCredential.upsert({
        where: {
          brandId_provider: { brandId, provider: "gmail" },
        },
        create: {
          brandId,
          provider: "gmail",
          label: emailAddress,
          encryptedValue: encryptedRefreshToken,
          isValid: true,
        },
        update: {
          label: emailAddress,
          encryptedValue: encryptedRefreshToken,
          isValid: true,
        },
      });

      // Upsert brand connection
      await tx.brandConnection.upsert({
        where: {
          brandId_provider: { brandId, provider: "gmail" },
        },
        create: {
          brandId,
          provider: "gmail",
          status: "connected",
          externalId: emailAddress,
        },
        update: {
          status: "connected",
          externalId: emailAddress,
        },
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
      `${appUrl}/settings/connections?connected=gmail`
    );
  } catch (error) {
    console.error("[gmail-callback] Error:", error);
    return Response.redirect(
      `${appUrl}/settings/connections?error=internal`
    );
  }
}
