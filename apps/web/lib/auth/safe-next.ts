/**
 * A same-site path to go to after signing in, or the fallback. "//x", "/\x"
 * and full URLs would send people to another site, so they're refused.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // Control characters (tabs, newlines) are stripped by URL parsers and can turn "/\t/x" into "//x".
  if ([...raw].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return fallback;
  return raw;
}
