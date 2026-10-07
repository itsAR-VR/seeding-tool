import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { apifyTokenStore } from "@/lib/apify/token-store";

export { currentApifyToken } from "@/lib/apify/token-store";

/**
 * Each company's creator searches run on its own Apify account. Companies a
 * platform admin marks as "shared" use Seed Scale's account instead.
 * The token is scoped to the running search, so one company's work can never
 * spend another's Apify credit.
 */

export class ApifyKeyMissingError extends Error {
  constructor() {
    super("Add your Apify API key in Settings > Creator search to find creators.");
  }
}

/** The Apify token this brand's searches should use. */
export async function resolveApifyToken(brandId: string): Promise<string> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { apifyTokenEnc: true, useSharedApify: true },
  });
  if (brand?.apifyTokenEnc) return decrypt(brand.apifyTokenEnc);
  const shared = process.env.APIFY_API_TOKEN;
  if (brand?.useSharedApify && shared) return shared;
  throw new ApifyKeyMissingError();
}

/** Run Apify work for one brand, on that brand's token. */
export async function withBrandApify<T>(brandId: string, fn: () => Promise<T>): Promise<T> {
  const token = await resolveApifyToken(brandId);
  return apifyTokenStore.run(token, fn);
}
