import { resolveProviderCredential } from "@/lib/integrations/state";

/**
 * Shopify Admin API client for a specific brand.
 *
 * Decrypts the stored access token from ProviderCredential (provider="shopify")
 * and returns helpers to make authenticated requests to the brand's store.
 */
export interface ShopifyClient {
  storeDomain: string;
  accessToken: string;
  /**
   * Make an authenticated request to the Shopify Admin REST API.
   */
  fetch(path: string, options?: RequestInit): Promise<Response>;
}

/**
 * Get a configured Shopify client for a brand.
 *
 * @throws if no valid Shopify credential exists for the brand.
 */
export async function getShopifyClient(brandId: string): Promise<ShopifyClient> {
  const resolved = await resolveProviderCredential(brandId, "shopify");

  if (!resolved.decryptedValue) {
    throw new Error(`No valid Shopify credential found for brand ${brandId}`);
  }

  const accessToken = resolved.decryptedValue;

  const connection = resolved.connection;

  if (!connection?.externalId) {
    throw new Error(`No connected Shopify store found for brand ${brandId}`);
  }

  const storeDomain = connection.externalId; // e.g. "my-store.myshopify.com"
  const apiVersion = "2024-01";

  return {
    storeDomain,
    accessToken,
    async fetch(path: string, options: RequestInit = {}): Promise<Response> {
      const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;
      return globalThis.fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
          ...options.headers,
        },
      });
    },
  };
}
