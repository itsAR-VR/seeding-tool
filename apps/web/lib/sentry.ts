/**
 * Sentry init stub — replace SENTRY_DSN env var when account is created.
 *
 * Graceful no-op when DSN is not set — safe to call unconditionally.
 */
import * as Sentry from "@sentry/nextjs";

export function initSentry() {
  if (!process.env.SENTRY_DSN) return; // graceful no-op until DSN is set

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || "development",
  });
}

/**
 * Capture an exception to Sentry (no-op if Sentry not initialized).
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.captureException(error, {
    extra: context,
  });
}
