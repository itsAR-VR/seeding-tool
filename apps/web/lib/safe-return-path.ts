/**
 * A `returnTo` value we can safely send someone to: a path on this site only.
 * Rejects other sites ("//evil.com", "/\\evil.com"), schemes ("javascript:"),
 * and anything with control characters. Returns null when it isn't safe.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2000) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  return raw;
}
