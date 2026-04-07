/**
 * Shared AI model configuration.
 *
 * Override via AI_MODEL env var for zero-deploy model swaps.
 */
export const AI_MODEL = process.env.AI_MODEL || "gpt-5-mini";
