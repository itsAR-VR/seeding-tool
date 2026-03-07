import { createSign } from "node:crypto";

const PROJECT = "seeding-tool-489501";
const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccountCredentials = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken(
  credentials: ServiceAccountCredentials
): Promise<string | null> {
  if (!credentials.client_email || !credentials.private_key) {
    console.warn(
      "[oauth-admin] Service account JSON missing client_email or private_key"
    );
    return null;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const audience = credentials.token_uri || GOOGLE_TOKEN_URL;

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: GOOGLE_OAUTH_SCOPE,
      aud: audience,
      iat: issuedAt,
      exp: expiresAt,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();

  const assertion = `${header}.${payload}.${signer.sign(
    credentials.private_key,
    "base64url"
  )}`;

  const tokenRes = await fetch(audience, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    console.warn(
      "[oauth-admin] Failed to exchange service account token:",
      await tokenRes.text()
    );
    return null;
  }

  const tokenPayload = (await tokenRes.json()) as {
    access_token?: string;
  };
  return tokenPayload.access_token ?? null;
}

export async function addGoogleTestUser(email: string): Promise<void> {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.warn(
      "[oauth-admin] GOOGLE_SERVICE_ACCOUNT_JSON not set, skipping test user add"
    );
    return;
  }

  let credentials: ServiceAccountCredentials;
  try {
    credentials = JSON.parse(
      Buffer.from(saJson, "base64").toString("utf-8")
    ) as ServiceAccountCredentials;
  } catch (error) {
    console.warn("[oauth-admin] Failed to parse service account JSON", error);
    return;
  }

  const accessToken = await getAccessToken(credentials);
  if (!accessToken) {
    return;
  }

  const getRes = await fetch(
    `https://content-oauthconfig.googleapis.com/v1/projects/${PROJECT}/oauthConfig`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!getRes.ok) {
    console.warn(
      "[oauth-admin] Failed to get oauth config:",
      await getRes.text()
    );
    return;
  }

  const config = (await getRes.json()) as {
    testUsers?: Array<{ emailAddresses?: string[] }>;
  };
  const existing = config.testUsers?.[0]?.emailAddresses ?? [];
  if (existing.includes(email)) {
    return;
  }

  const patchRes = await fetch(
    `https://content-oauthconfig.googleapis.com/v1/projects/${PROJECT}/oauthConfig?updateMask=testUsers`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testUsers: [{ emailAddresses: [...existing, email] }],
      }),
    }
  );

  if (!patchRes.ok) {
    console.warn(
      "[oauth-admin] Failed to patch test users:",
      await patchRes.text()
    );
  }
}
