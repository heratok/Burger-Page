import { describe, it, expect } from 'vitest';
import {
  RESTAURANT_TEMPLATES,
  getRestaurantTemplate,
  listRestaurantTemplateSummaries,
  scaleTemplatePrice,
  SUPPORTED_TEMPLATE_CURRENCIES,
} from '../../../src/domain/templates/restaurantTemplates.js';
import { createRestaurantSchema } from '@burger-page/contracts';

describe('restaurant templates (data-only module)', () => {
  it('declares exactly the template ids the create contract accepts', () => {
    const ids = RESTAURANT_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(['blank', 'burger', 'pizza', 'tacos']);
    for (const id of ids) {
      expect(createRestaurantSchema.safeParse({ name: 'A', slug: 'a', templateType: id }).success).toBe(true);
    }
  });

  it('is internally consistent: every product category exists and every name is unique', () => {
    for (const t of RESTAURANT_TEMPLATES) {
      expect(new Set(t.categories).size).toBe(t.categories.length);
      expect(new Set(t.products.map((p) => p.name)).size).toBe(t.products.length);
      expect(new Set(t.additions.map((a) => a.name)).size).toBe(t.additions.length);
      for (const p of t.products) {
        expect(t.categories).toContain(p.category);
        expect(p.price).toBeGreaterThan(0);
      }
      for (const a of t.additions) expect(a.price).toBeGreaterThan(0);
    }
  });

  it('keeps blank empty and the sample templates populated', () => {
    const blank = getRestaurantTemplate('blank')!;
    expect(blank.products).toHaveLength(0);
    expect(blank.additions).toHaveLength(0);
    expect(getRestaurantTemplate('burger')!.products.length).toBeGreaterThanOrEqual(6);
    expect(getRestaurantTemplate('burger')!.additions.length).toBeGreaterThanOrEqual(7);
  });

  it('derives the summaries (and their counts) from the same data', () => {
    const summaries = listRestaurantTemplateSummaries();
    expect(summaries.map((s) => s.id)).toEqual(RESTAURANT_TEMPLATES.map((t) => t.id));
    for (const s of summaries) {
      const t = getRestaurantTemplate(s.id)!;
      expect(s).toEqual({
        id: t.id,
        name: t.name,
        description: t.description,
        productCount: t.products.length,
        additionCount: t.additions.length,
        supportedCurrencies: t.products.length > 0 || t.additions.length > 0 ? SUPPORTED_TEMPLATE_CURRENCIES : null,
      });
    }
  });

  it('does not put counts in the description, so the copy cannot drift from the data', () => {
    for (const t of RESTAURANT_TEMPLATES) expect(t.description).not.toMatch(/\d/);
  });

  it('returns undefined for an unknown template', () => {
    expect(getRestaurantTemplate('sushi')).toBeUndefined();
  });

  describe('scaleTemplatePrice', () => {
    it('keeps COP prices as declared', () => {
      expect(scaleTemplatePrice(28000, 'COP')).toBe(28000);
    });
    it('scales to a currency with a friendly rounding step and never returns zero', () => {
      expect(scaleTemplatePrice(28000, 'USD')).toBeGreaterThan(0);
      expect(scaleTemplatePrice(28000, 'USD')).toBeLessThan(15);
      expect(scaleTemplatePrice(1000, 'USD')).toBeGreaterThan(0);
      expect(scaleTemplatePrice(28000, 'MXN') % 1).toBe(0);
    });
    it('keeps the declared numbers for a currency without a known scale', () => {
      expect(scaleTemplatePrice(28000, 'XYZ')).toBe(28000);
    });
  });
});
