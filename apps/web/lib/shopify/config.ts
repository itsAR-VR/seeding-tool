/**
 * Shared Shopify API configuration.
 *
 * Override via SHOPIFY_API_VERSION env var for zero-deploy version bumps.
 */
export const SHOPIFY_API_VERSION =
  process.env.SHOPIFY_API_VERSION ?? "2025-04";
