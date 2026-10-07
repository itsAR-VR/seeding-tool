import { AsyncLocalStorage } from "node:async_hooks";

/** The Apify token of the brand whose search is running (see lib/apify/token.ts). */
export const apifyTokenStore = new AsyncLocalStorage<string>();

/** The token for the Apify work currently running. Throws outside withBrandApify. */
export function currentApifyToken(): string {
  const token = apifyTokenStore.getStore();
  if (!token) throw new Error("Apify called outside a brand's search (missing withBrandApify)");
  return token;
}
