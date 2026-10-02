import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeSlug } from '../../../src/domain/shared/slug.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

// A slug equal to a static segment under /api/restaurants/ would be shadowed
// by that route, so every static segment declared in the routes file must be
// reserved. Derived from the source so a new static route cannot be forgotten.
function staticRouteSegments(): string[] {
  const file = fileURLToPath(new URL('../../../src/infrastructure/http/routes/restaurants.routes.ts', import.meta.url));
  const source = readFileSync(file, 'utf8');
  const segments = new Set<string>();
  for (const m of source.matchAll(/fastify\.(?:get|post|put|patch|delete)\(\s*'\/([^'/]+)/g)) {
    if (!m[1].startsWith(':')) segments.add(m[1]);
  }
  return [...segments];
}

describe('reserved slugs', () => {
  const segments = staticRouteSegments();

  it('finds the static segments of the restaurants routes', () => {
    expect(segments).toEqual(expect.arrayContaining(['deleted', 'templates']));
  });

  it.each(segments)('rejects the static route segment "%s" as a slug', (segment) => {
    expect(() => normalizeSlug(segment)).toThrow(ValidationError);
    expect(() => normalizeSlug(segment.toUpperCase())).toThrow(ValidationError);
  });

  it('still accepts ordinary slugs', () => {
    expect(normalizeSlug('templates-grill')).toBe('templates-grill');
  });
});
