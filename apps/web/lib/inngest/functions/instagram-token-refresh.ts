import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import {
  refreshLongLivedToken,
  InstagramApiError,
} from "@/lib/instagram/client";
import { log } from "@/lib/logger";

/** Days before expiry to trigger a refresh. */
const REFRESH_WINDOW_DAYS = 7;

/** Consecutive failures before marking credential invalid. */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Daily cron (4 AM UTC): refresh Instagram tokens nearing expiry.
 *
 * For each ProviderCredential where:
 *   provider = "instagram" AND isValid = true AND expiresAt < now + 7 days
 *
 * 1. Decrypt the stored token
 * 2. Call refreshLongLivedToken() to get a new 60-day token
 * 3. Encrypt and store the new token, update expiresAt
 * 4. On failure: create InterventionCase with type "auth_failure", priority "high"
 * 5. On 3 consecutive failures: mark credential isValid = false
 */
export const instagramTokenRefresh = inngest.createFunction(
  {
    id: "instagram-token-refresh",
    name: "Instagram Token Refresh",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "0 4 * * *" }, // Daily at 4 AM UTC
  async ({ step }) => {
    const refreshWindow = new Date();
    refreshWindow.setDate(refreshWindow.getDate() + REFRESH_WINDOW_DAYS);

    const credentials = await step.run(
      "fetch-expiring-credentials",
      async () => {
        const creds = await prisma.providerCredential.findMany({
          where: {
            provider: "instagram",
            isValid: true,
            expiresAt: {
              lt: refreshWindow,
            },
          },
          select: {
            id: true,
            brandId: true,
            encryptedValue: true,
            expiresAt: true,
          },
        });

        return creds.map((c) => ({
          id: c.id,
          brandId: c.brandId,
          encryptedValue: c.encryptedValue,
          expiresAt: c.expiresAt?.toISOString() ?? null,
        }));
      }
    );

    if (credentials.length === 0) {
      return { status: "no_expiring_tokens", refreshed: 0, failed: 0 };
    }

    const results: Array<{
      credentialId: string;
      brandId: string;
      status: "refreshed" | "failed";
      error?: string;
    }> = [];

    for (const cred of credentials) {
      const result = await step.run(
        `refresh-token-${cred.id}`,
        async () => {
          try {
            const decrypted = decrypt(cred.encryptedValue);
            const payload = JSON.parse(decrypted) as {
              accessToken: string;
              igUserId: string;
              igUsername?: string;
            };

            if (!payload.accessToken) {
              return {
                credentialId: cred.id,
                brandId: cred.brandId,
                status: "failed" as const,
                error: "No accessToken in credential payload",
              };
            }

            const refreshed = await refreshLongLivedToken(
              payload.accessToken
            );

            // Build new payload with the refreshed token (immutable)
            const newPayload = {
              ...payload,
              accessToken: refreshed.access_token,
            };

            const encryptedValue = encrypt(JSON.stringify(newPayload));
            const newExpiresAt = new Date(
              Date.now() + refreshed.expires_in * 1000
            );

            await prisma.providerCredential.update({
              where: { id: cred.id },
              data: {
                encryptedValue,
                expiresAt: newExpiresAt,
              },
            });

            log("info", "instagram.token_refresh.success", {
              credentialId: cred.id,
              brandId: cred.brandId,
              newExpiresAt: newExpiresAt.toISOString(),
            });

            return {
              credentialId: cred.id,
              brandId: cred.brandId,
              status: "refreshed" as const,
            };
          } catch (error) {
            const errMsg =
              error instanceof InstagramApiError
                ? `IG API Error [${error.code}]: ${error.message}`
                : error instanceof Error
                  ? error.message
                  : "Unknown error";

            log("error", "instagram.token_refresh.failed", {
              credentialId: cred.id,
              brandId: cred.brandId,
              error: errMsg,
            });

            // Count recent consecutive failures for this credential
            const recentFailures = await countConsecutiveFailures(
              cred.brandId,
              cred.id
            );
            const totalFailures = recentFailures + 1;

            // Create intervention case
            await prisma.interventionCase.create({
              data: {
                type: "auth_failure",
                status: "open",
                priority: "high",
                title: `Instagram token refresh failed for credential ${cred.id} (attempt ${totalFailures})`,
                description: `Token refresh failed for brand ${cred.brandId}: ${errMsg}`,
                brandId: cred.brandId,
              },
            });

            // After MAX_CONSECUTIVE_FAILURES, mark credential invalid
            if (totalFailures >= MAX_CONSECUTIVE_FAILURES) {
              await prisma.providerCredential.update({
                where: { id: cred.id },
                data: { isValid: false },
              });

              log("warn", "instagram.token_refresh.credential_invalidated", {
                credentialId: cred.id,
                brandId: cred.brandId,
                consecutiveFailures: totalFailures,
              });
            }

            return {
              credentialId: cred.id,
              brandId: cred.brandId,
              status: "failed" as const,
              error: errMsg,
            };
          }
        }
      );

      results.push(result);
    }

    const refreshed = results.filter((r) => r.status === "refreshed").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return {
      status: failed > 0 ? "completed_with_errors" : "completed",
      refreshed,
      failed,
      results,
    };
  }
);

/**
 * Count consecutive auth_failure InterventionCases for a brand (recent 7 days).
 * Used to decide when to mark a credential invalid.
 */
async function countConsecutiveFailures(
  brandId: string,
  credentialId: string
): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // "Consecutive" means no success in between: a successful refresh writes
  // the credential row, so only failures after its last update count.
  const credential = await prisma.providerCredential.findUnique({
    where: { id: credentialId },
    select: { updatedAt: true },
  });
  const since =
    credential && credential.updatedAt > sevenDaysAgo
      ? credential.updatedAt
      : sevenDaysAgo;

  // Scope to specific credential via title to avoid cross-credential contamination
  const failures = await prisma.interventionCase.count({
    where: {
      brandId,
      type: "auth_failure",
      title: { contains: `credential ${credentialId}` },
      createdAt: { gt: since },
    },
  });

  return failures;
}
