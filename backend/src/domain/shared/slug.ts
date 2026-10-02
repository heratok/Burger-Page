import { ValidationError } from '../errors/DomainErrors.js';

/** Longest slug accepted (a DNS label), so slugs stay usable in URLs. */
export const MAX_SLUG_LENGTH = 63;

/** Slugs that would shadow a fixed route under /api/restaurants/. */
const RESERVED_SLUGS = new Set(['deleted']);

/**
 * Normalizes a storefront slug the way tenants have always been created:
 * lowercase, trimmed, anything outside [a-z0-9-] becomes '-' and runs of '-'
 * collapse. Rejects what cannot identify a store (nothing but separators, or
 * longer than a URL label).
 */
export function normalizeSlug(raw: string): string {
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
  if (!slug || !/[a-z0-9]/.test(slug)) {
    throw new ValidationError('A valid slug is required');
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    throw new ValidationError(`The slug must be at most ${MAX_SLUG_LENGTH} characters`);
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new ValidationError(`The slug "${slug}" is reserved`);
  }
  return slug;
}
