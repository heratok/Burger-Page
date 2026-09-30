import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapRow, PgRestaurantRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';

const h = vi.hoisted(() => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
  return { calls, client };
});

vi.mock('../../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (_ctx: unknown, cb: (c: unknown) => Promise<unknown>) => cb(h.client),
}));

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

describe('PgRestaurantRepository mapRow - opening hours text (flow fix 1.2)', () => {
  it('returns opening_hours_text as config.openingHours', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      opening_hours_text: 'Lun-Vie 8am - 10pm',
      open_time: '12:00:00', close_time: '22:30:00',
    });
    expect(r.config.openingHours).toBe('Lun-Vie 8am - 10pm');
    // the structured hours still come from the time columns
    expect(r.openingHours).toEqual({ open: '12:00', close: '22:30' });
  });

  it('falls back to "open - close" when the text is null', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      opening_hours_text: null, open_time: '09:00:00', close_time: '21:15:00',
    });
    expect(r.config.openingHours).toBe('09:00 - 21:15');
  });
});

describe('PgRestaurantRepository mapRow - branding fields (flow fix 1.3)', () => {
  it('returns every stored branding field in config', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      primary_hover_color: '#112233',
      font_family: 'serif',
      card_radius: 'full',
      card_style: 'glass',
      compact_grid: true,
      show_badges: false,
    });
    expect(r.config).toMatchObject({
      primaryHoverColor: '#112233',
      fontFamily: 'serif',
      cardRadius: 'full',
      cardStyle: 'glass',
      compactGrid: true,
      showBadges: false,
    });
  });

  it('uses the schema defaults when branding columns are missing', () => {
    const r = mapRow({ id: 'r', slug: 'r', name: 'R' });
    expect(r.config).toMatchObject({
      primaryHoverColor: '#F25C69',
      fontFamily: 'sans',
      cardRadius: 'md',
      cardStyle: 'elevated',
      compactGrid: false,
      showBadges: true,
    });
  });
});

describe('PgRestaurantRepository.save - hours and branding round-trip', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  const valuesFor = (table: string): Record<string, unknown> => {
    const call = h.calls.find((c) => c.sql.includes(`INSERT INTO ${table} `));
    if (!call) throw new Error(`no upsert for ${table}`);
    const cols = /\(([^)]*)\) VALUES/.exec(call.sql)![1].split(',').map((s) => s.trim());
    return Object.fromEntries(cols.map((c, i) => [c, call.values[i]]));
  };

  const baseRestaurant = (config: Record<string, unknown>) => ({
    id: 'r1', slug: 'r1', name: 'R1', theme: 'dark-charcoal', isActive: true,
    openingHours: { open: '12:00', close: '22:30' },
    config,
  });

  it('keeps open_time/close_time consistent with a parseable hours text', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({ openingHours: '08:00 - 23:15' }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings.opening_hours_text).toBe('08:00 - 23:15');
    expect(settings.open_time).toBe('08:00:00');
    expect(settings.close_time).toBe('23:15:00');
  });

  it('keeps the structured times when the text is free-form', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({ openingHours: 'Lun-Vie 8am - 10pm' }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings.opening_hours_text).toBe('Lun-Vie 8am - 10pm');
    expect(settings.open_time).toBe('12:00:00');
    expect(settings.close_time).toBe('22:30:00');
  });

  it('round-trips branding and hours text: save -> mapRow', async () => {
    const config = {
      openingHours: 'Lun-Vie 8am - 10pm',
      primaryHoverColor: '#AABBCC', fontFamily: 'mono', cardRadius: 'lg',
      cardStyle: 'minimal', compactGrid: true, showBadges: false,
    };
    await new PgRestaurantRepository().save(baseRestaurant(config) as any);
    const settings = valuesFor('public.restaurant_settings');
    const branding = valuesFor('public.restaurant_branding');
    const restored = mapRow({ id: 'r1', slug: 'r1', name: 'R1', ...settings, ...branding });
    expect(restored.config).toMatchObject(config);
  });
});
