/**
 * Slug utilities for restaurant directory routing (RD-1/SA-2).
 * Slugs are URL-safe, immutable once created, and derived from names
 * via transliteration of Spanish non-ASCII characters.
 */

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
 * available numeric suffix (-2, -3, …) until the slug is unique.
 */
export function ensureUniqueSlug(slug: string, existing: string[]): string {
  if (!existing.includes(slug)) return slug
  let suffix = 2
  while (existing.includes(`${slug}-${suffix}`)) suffix++
  return `${slug}-${suffix}`
}

/** True when a manual slug override is already in use (reject, never auto-suffix). */
export function isSlugTaken(slug: string, existing: string[]): boolean {
  return existing.includes(slug)
}