/**
 * Email enrichment service.
 *
 * Orchestrates enrichment providers to find and persist
 * creator contact emails from their social handles.
 */

import { prisma } from "@/lib/prisma";
import { findEmailsByInstagramHandles } from "./providers/apify-email";

export type EnrichmentStatus =
  | "found"
  | "not_found"
  | "already_has_email"
  | "no_handle"
  | "error";

export type EnrichmentResult = {
  creatorId: string;
  handle: string | null;
  status: EnrichmentStatus;
  email?: string;
  error?: string;
};

/**
 * Enrich emails for a batch of creators.
 *
 * Flow:
 * 1. Load creators from DB (scoped to brand)
 * 2. Skip creators who already have emails
 * 3. Skip creators without IG handles
 * 4. Call Apify enrichment for remaining
 * 5. Update found emails in DB
 * 6. Return per-creator results
 */
export async function enrichCreatorEmails(
  creatorIds: string[],
  brandId: string
): Promise<EnrichmentResult[]> {
  const creators = await prisma.creator.findMany({
    where: {
      id: { in: creatorIds },
      brandId,
    },
    select: {
      id: true,
      email: true,
      instagramHandle: true,
    },
  });

  const results: EnrichmentResult[] = [];
  const toEnrich: Array<{ id: string; handle: string }> = [];

  for (const creator of creators) {
    if (creator.email) {
      results.push({
        creatorId: creator.id,
        handle: creator.instagramHandle,
        status: "already_has_email",
        email: creator.email,
      });
      continue;
    }

    if (!creator.instagramHandle) {
      results.push({
        creatorId: creator.id,
        handle: null,
        status: "no_handle",
      });
      continue;
    }

    toEnrich.push({ id: creator.id, handle: creator.instagramHandle });
  }

  if (toEnrich.length === 0) {
    return results;
  }

  // Call Apify enrichment
  let emailMap: Map<string, string>;
  try {
    emailMap = await findEmailsByInstagramHandles(
      toEnrich.map((c) => c.handle)
    );
  } catch (err) {
    // If enrichment provider fails, mark all as error
    for (const creator of toEnrich) {
      results.push({
        creatorId: creator.id,
        handle: creator.handle,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown enrichment error",
      });
    }
    return results;
  }

  // Process results and update DB
  for (const creator of toEnrich) {
    const normalizedHandle = creator.handle
      .replace(/^@/, "")
      .toLowerCase()
      .trim();
    const foundEmail = emailMap.get(normalizedHandle);

    if (foundEmail) {
      try {
        await prisma.creator.update({
          where: { id: creator.id },
          data: { email: foundEmail },
        });
        results.push({
          creatorId: creator.id,
          handle: creator.handle,
          status: "found",
          email: foundEmail,
        });
      } catch (err) {
        results.push({
          creatorId: creator.id,
          handle: creator.handle,
          status: "error",
          error:
            err instanceof Error ? err.message : "Failed to update creator",
        });
      }
    } else {
      results.push({
        creatorId: creator.id,
        handle: creator.handle,
        status: "not_found",
      });
    }
  }

  return results;
}
