/**
 * Slug utilities for direct-link restaurant routing (B2B model): clients reach
 * a restaurant only through the shared `/:slug` storefront link; the root
 * redirects to the admin panel and there is no public directory.
 * Slugs are URL-safe, immutable once created, and derived from names
 * via transliteration of Spanish non-ASCII characters.
 */

/**
 * System route slugs that restaurant slugs must never collide with. The
 * storefront lives at `/:slug`, so every fixed top-level route segment, the
 * legacy `/r/:slug` prefix, and every admin section name is reserved: a
 * restaurant named "Admin" or "Config" would otherwise shadow the panel or
 * break its links. Extend this list whenever a new fixed route is added.
 */
export const RESERVED_SLUGS = [
  // Legacy storefront prefix kept for redirects.
  "r",
  // Unified admin panel at /admin and its sections.
  "admin",
  "restaurants",
  "products",
  "orders",
  "sales",
  "config",
  "new",
  "edit",
  "password",
  // Defensive reservations: no live top-level routes use these today, but
  // keeping them reserved protects future pages and shared links from ever
  // colliding with a restaurant slug.
  "login",
  "contacto",
  "cart",
  "form",
  "settings",
  "pedido",
  "perfil",
  "api",
  "assets",
  "cuenta",
  "buscar",
  "search",
  "checkout",
  "pago",
  "ayuda",
  "help",
  "terminos",
  "terms",
  "privacidad",
  "privacy",
]

/** Spanish/Latin transliteration map (lowercase input → plain ASCII). */
const TRANSLITERATION: Record<string, string> = {
  ñ: "n",
  á: "a",
  à: "a",
  â: "a",
  ä: "a",
  ã: "a",
  å: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  ö: "o",
  õ: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ý: "y",
  ÿ: "y",
}

/**
 * Converts a display name into a URL-safe slug: transliterates non-ASCII
 * characters, lowercases, keeps only [a-z0-9], joins runs of separators
 * with a single dash and trims leading/trailing dashes.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Returns the slug unchanged when free; otherwise appends the lowest
 * available numeric suffix (-2, -3, …) until the slug is unique. Reserved
 * system slugs count as taken, so an auto-slug that collides with a route
 * (e.g. a restaurant named "Admin") gets suffixed like any other collision.
 */
export function ensureUniqueSlug(slug: string, existing: string[]): string {
  const isTaken = (candidate: string) =>
    existing.includes(candidate) || RESERVED_SLUGS.includes(candidate)
  if (!isTaken(slug)) return slug
  let suffix = 2
  while (isTaken(`${slug}-${suffix}`)) suffix++
  return `${slug}-${suffix}`
}

/**
 * True when a manual slug override is already in use or reserved by a system
 * route (reject both, never auto-suffix).
 */
export function isSlugTaken(slug: string, existing: string[]): boolean {
  return existing.includes(slug) || RESERVED_SLUGS.includes(slug)
}