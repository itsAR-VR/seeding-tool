import { randomBytes } from "crypto";

/**
 * A URL-safe, globally unique slug. Accents become plain letters, emoji and
 * symbols drop out, and a random suffix keeps two companies with the same name
 * (or a renamed brand) from ever colliding on the unique slug column.
 */
export function brandSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return `${base || "brand"}-${randomBytes(4).toString("hex")}`;
}

