import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const UNIPILE_BASE_URL =
  process.env.UNIPILE_BASE_URL ?? "https://api11.unipile.com:14124";

export type UnipileClient = {
  baseUrl: string;
  apiKey: string;
  accountId: string;
  fetch: (
    path: string,
    options?: RequestInit
  ) => Promise<Response>;
};

/**
 * Get a configured Unipile HTTP client for a brand.
 *
 * Decrypts the API key from ProviderCredential (provider="unipile").
 * Throws if no Unipile credential is configured for this brand.
 */
export async function getUnipileClient(
  brandId: string
): Promise<UnipileClient> {
  const credential = await prisma.providerCredential.findFirst({
    where: {
      brandId,
      provider: "unipile",
      isValid: true,
    },
  });

  if (!credential) {
    throw new Error(
      `No Unipile credential found for brand ${brandId}. Connect Unipile in Settings → Connections.`
    );
  }

  const decrypted = decrypt(credential.encryptedValue);
  let parsed: { apiKey: string; accountId?: string };
  try {
    parsed = JSON.parse(decrypted);
  } catch {
    // Legacy: plain API key without JSON wrapper
    parsed = { apiKey: decrypted };
  }

  const apiKey = parsed.apiKey;
  const accountId = parsed.accountId ?? "";

  const client: UnipileClient = {
    baseUrl: UNIPILE_BASE_URL,
    apiKey,
    accountId,
    fetch: async (path: string, options?: RequestInit) => {
      const url = `${UNIPILE_BASE_URL}${path}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(options?.headers ?? {}),
        },
      });
      return res;
    },
  };

  return client;
}
