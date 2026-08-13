/**
 * Shared application configuration constants.
 *
 * Centralises environment-derived values so that auth callbacks, billing
 * redirects, and webhook registration all resolve the same base URL.
 */

/** Base URL of the running application (no trailing slash). */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Base URL used for Shopify webhook callback registration.
 *
 * Prefers NEXT_PUBLIC_APP_URL, falls back to the Vercel-provided URL,
 * and finally to localhost for local development.
 */
export const WEBHOOK_CALLBACK_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
