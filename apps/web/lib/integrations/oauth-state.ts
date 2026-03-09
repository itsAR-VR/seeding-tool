import "server-only";

export type IntegrationOAuthState = {
  brandId: string;
  returnTo?: string;
  nonce?: string;
};

export function encodeIntegrationOAuthState(
  payload: IntegrationOAuthState
): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeIntegrationOAuthState(
  rawState: string | null
): IntegrationOAuthState | null {
  if (!rawState) {
    return null;
  }

  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<IntegrationOAuthState>;
    if (!parsed.brandId || typeof parsed.brandId !== "string") {
      return null;
    }

    return {
      brandId: parsed.brandId,
      returnTo:
        typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")
          ? parsed.returnTo
          : undefined,
      nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
    };
  } catch {
    // Backward compatibility for legacy state=brandId callbacks.
    if (rawState.startsWith("brand_") || rawState.length > 8) {
      return { brandId: rawState };
    }
    return null;
  }
}

export function buildConnectionRedirect(
  appUrl: string,
  returnTo: string | undefined,
  params: Record<string, string>
) {
  const target = new URL(returnTo ?? "/settings/connections", appUrl);

  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }

  return target.toString();
}
