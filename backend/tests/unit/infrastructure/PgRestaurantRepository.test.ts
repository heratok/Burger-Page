import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapRow, PgRestaurantRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';

const h = vi.hoisted(() => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const contexts: Record<string, unknown>[] = [];
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
  return { calls, contexts, client };
});

vi.mock('../../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (ctx: Record<string, unknown>, cb: (c: unknown) => Promise<unknown>) => {
    h.contexts.push(ctx);
    return cb(h.client);
  },
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

describe('PgRestaurantRepository mapRow - opening hours derived from the time columns (db-hardening-0008 T7)', () => {
  it('derives config.openingHours from open_time/close_time', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      open_time: '09:00:00', close_time: '21:15:00',
    });
    expect(r.config.openingHours).toBe('09:00 - 21:15');
    expect(r.openingHours).toEqual({ open: '09:00', close: '21:15' });
  });

  it('ignores a legacy opening_hours_text key: the time columns are the single source', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      opening_hours_text: 'Lun-Vie 8am - 10pm',
      open_time: '12:00:00', close_time: '22:30:00',
    });
    expect(r.config.openingHours).toBe('12:00 - 22:30');
  });

  it('falls back to the default hours when the time columns are null', () => {
    const r = mapRow({ id: 'r', slug: 'r', name: 'R', open_time: null, close_time: null });
    expect(r.config.openingHours).toBe('12:00 - 22:30');
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

  it('parses a "HH:MM - HH:MM" hours text into open_time/close_time and never writes a text column', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({ openingHours: '08:00 - 23:15' }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings).not.toHaveProperty('opening_hours_text');
    expect(settings.open_time).toBe('08:00:00');
    expect(settings.close_time).toBe('23:15:00');
  });

  it('keeps the structured times when the text is free-form (the text is not stored)', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({ openingHours: 'Lun-Vie 8am - 10pm' }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings).not.toHaveProperty('opening_hours_text');
    expect(settings.open_time).toBe('12:00:00');
    expect(settings.close_time).toBe('22:30:00');
  });

  it('does not select the dropped opening_hours_text column when reading', async () => {
    h.calls.length = 0;
    await new PgRestaurantRepository().findBySlug('r1');
    expect(h.calls[0].sql).not.toContain('opening_hours_text');
    expect(h.calls[0].sql).toContain('s.open_time');
  });

  it('round-trips branding and hours: save -> mapRow', async () => {
    const config = {
      openingHours: '12:00 - 22:30',
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

describe('PgRestaurantRepository.findBySlug - slug-scoped public read (db-hardening-0008 T4)', () => {
  it('declares the slug in the tenant context, without tenant id or admin role', async () => {
    h.contexts.length = 0;
    await new PgRestaurantRepository().findBySlug('burger-house');
    expect(h.contexts).toEqual([{ restaurantId: null, restaurantSlug: 'burger-house' }]);
  });
});
