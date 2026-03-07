/**
 * Next.js 15 instrumentation hook.
 * Called once when the server starts.
 */
export async function register() {
  // Initialize Sentry for error tracking
  const { initSentry } = await import("@/lib/sentry");
  initSentry();
}
