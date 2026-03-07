/**
 * Structured JSON logger — tenant/entity/job context on every log line.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log("info", "gmail.ingest.received", { brandId, messageId });
 *   log("error", "ai.draft.failed", { brandId, error: err.message });
 */
export function log(
  level: "info" | "warn" | "error",
  event: string,
  ctx: Record<string, unknown> = {}
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...ctx,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
