/**
 * HTML escaping for template variable interpolation.
 *
 * ALL user-supplied values (creator name, product name, brand name, etc.)
 * MUST pass through escapeHtml() before insertion into HTML templates.
 * This prevents XSS in rendered emails.
 */

/**
 * Escape a string for safe insertion into HTML content.
 * Replaces &, <, >, ", and ' with their HTML entity equivalents.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
