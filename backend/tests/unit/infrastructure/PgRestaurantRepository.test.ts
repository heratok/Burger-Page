import { describe, it, expect } from 'vitest';
import { mapRow } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';

describe('PgRestaurantRepository mapRow', () => {
  it('preserves an empty array of categories without forcing burger defaults (CONF-04)', () => {
    const row = {
      id: 'rest-empty',
      slug: 'rest-empty',
      name: 'Pizzeria Don Juan',
      categories: [],
    };

    const restaurant = mapRow(row);
    expect(restaurant.categories).toEqual([]);
  });

  it('preserves empty categories from JSON string "[]" (CONF-04)', () => {
    const row = {
      id: 'rest-json-empty',
      slug: 'rest-json-empty',
      name: 'Sushi Bar',
      categories: '[]',
    };

    const restaurant = mapRow(row);
    expect(restaurant.categories).toEqual([]);
  });

  it('parses valid categories from array', () => {
    const row = {
      id: 'rest-cats',
      slug: 'rest-cats',
      name: 'Tacos Lupita',
      categories: ['Tacos', 'Bebidas'],
    };

    const restaurant = mapRow(row);
    expect(restaurant.categories).toEqual(['Tacos', 'Bebidas']);
  });

  it('yields an empty list (no fabricated default) when row.categories is null or undefined', () => {
    const row = {
      id: 'rest-null',
      slug: 'rest-null',
      name: 'Default Burger',
      categories: null,
    };

    const restaurant = mapRow(row);
    expect(restaurant.categories).toEqual([]);
  });
});
