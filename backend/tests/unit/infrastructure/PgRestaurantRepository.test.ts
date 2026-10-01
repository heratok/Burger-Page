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

describe('PgRestaurantRepository mapRow - weekly schedule (store-opening-hours T2)', () => {
  const allWeek = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: '09:00', close: '21:15' }));

  it('maps the aggregated schedule, timezone and paused flag', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      schedule: allWeek, timezone: 'America/Mexico_City', orders_paused: true,
    });
    expect(r.schedule).toEqual(allWeek);
    expect(r.timezone).toBe('America/Mexico_City');
    expect(r.ordersPaused).toBe(true);
  });

  it('accepts the schedule as a JSON string', () => {
    const r = mapRow({ id: 'r', slug: 'r', name: 'R', schedule: JSON.stringify(allWeek) });
    expect(r.schedule).toEqual(allWeek);
  });

  it('derives the legacy openingHours object and config.openingHours text from the schedule', () => {
    const r = mapRow({ id: 'r', slug: 'r', name: 'R', schedule: allWeek });
    expect(r.openingHours).toEqual({ open: '09:00', close: '21:15' });
    expect(r.config.openingHours).toBe('09:00 - 21:15');
  });

  it('ignores legacy open_time/close_time keys: the weekly table is the single source', () => {
    const r = mapRow({
      id: 'r', slug: 'r', name: 'R',
      open_time: '01:00:00', close_time: '02:00:00', schedule: allWeek,
    });
    expect(r.config.openingHours).toBe('09:00 - 21:15');
  });

  it('defaults to Bogota, not paused and an empty (always closed) schedule when the columns are missing', () => {
    const r = mapRow({ id: 'r', slug: 'r', name: 'R' });
    expect(r.schedule).toEqual([]);
    expect(r.timezone).toBe('America/Bogota');
    expect(r.ordersPaused).toBe(false);
    expect(r.openingHours).toBeUndefined();
    expect(r.config.openingHours).toBe('');
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

describe('PgRestaurantRepository.save - schedule and branding round-trip', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  const valuesFor = (table: string): Record<string, unknown> => {
    const call = h.calls.find((c) => c.sql.includes(`INSERT INTO ${table} `));
    if (!call) throw new Error(`no upsert for ${table}`);
    const cols = /\(([^)]*)\) VALUES/.exec(call.sql)![1].split(',').map((s) => s.trim());
    return Object.fromEntries(cols.map((c, i) => [c, call.values[i]]));
  };

  const schedule = [
    { dayOfWeek: 1, open: '08:00', close: '23:15' },
    { dayOfWeek: 5, open: '12:00', close: '14:00' },
    { dayOfWeek: 5, open: '18:00', close: '02:00' },
  ];

  const baseRestaurant = (config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
    id: 'r1', slug: 'r1', name: 'R1', theme: 'dark-charcoal', isActive: true,
    schedule, timezone: 'America/Bogota', ordersPaused: false,
    config,
    ...extra,
  });

  it('writes timezone and orders_paused to restaurant_settings, never the dropped time columns', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({}, { timezone: 'America/Lima', ordersPaused: true }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings.timezone).toBe('America/Lima');
    expect(settings.orders_paused).toBe(true);
    expect(settings).not.toHaveProperty('open_time');
    expect(settings).not.toHaveProperty('close_time');
    expect(settings).not.toHaveProperty('opening_hours_text');
  });

  it('replaces the weekly rows: delete then one insert per range with a generated id', async () => {
    await new PgRestaurantRepository().save(baseRestaurant() as any);
    const del = h.calls.findIndex((c) => c.sql.includes('DELETE FROM public.restaurant_opening_hours'));
    const ins = h.calls.filter((c) => c.sql.includes('INSERT INTO public.restaurant_opening_hours'));
    expect(del).toBeGreaterThanOrEqual(0);
    expect(h.calls[del].values).toEqual(['r1']);
    expect(ins).toHaveLength(3);
    expect(h.calls.indexOf(ins[0])).toBeGreaterThan(del);
    expect(ins.map((c) => c.values.slice(2))).toEqual([
      [1, '08:00', '23:15'],
      [5, '12:00', '14:00'],
      [5, '18:00', '02:00'],
    ]);
    for (const c of ins) {
      expect(c.values[0]).toMatch(/^oh_[0-9a-f-]{36}$/);
      expect(c.values[1]).toBe('r1');
    }
  });

  it('an empty schedule clears the rows and inserts none (restaurant closed every day)', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({}, { schedule: [] }) as any);
    expect(h.calls.some((c) => c.sql.includes('DELETE FROM public.restaurant_opening_hours'))).toBe(true);
    expect(h.calls.some((c) => c.sql.includes('INSERT INTO public.restaurant_opening_hours'))).toBe(false);
  });

  it('ignores config.openingHours text: only the schedule is persisted', async () => {
    await new PgRestaurantRepository().save(baseRestaurant({ openingHours: '08:00 - 23:15' }) as any);
    const settings = valuesFor('public.restaurant_settings');
    expect(settings).not.toHaveProperty('opening_hours_text');
    expect(settings).not.toHaveProperty('open_time');
  });

  it('reads the schedule from restaurant_opening_hours and not from the dropped columns', async () => {
    h.calls.length = 0;
    await new PgRestaurantRepository().findBySlug('r1');
    expect(h.calls[0].sql).not.toContain('opening_hours_text');
    expect(h.calls[0].sql).not.toContain('s.open_time');
    expect(h.calls[0].sql).toContain('public.restaurant_opening_hours');
    expect(h.calls[0].sql).toContain('s.timezone');
    expect(h.calls[0].sql).toContain('s.orders_paused');
  });

  it('round-trips branding: save -> mapRow', async () => {
    const config = {
      primaryHoverColor: '#AABBCC', fontFamily: 'mono', cardRadius: 'lg',
      cardStyle: 'minimal', compactGrid: true, showBadges: false,
    };
    await new PgRestaurantRepository().save(baseRestaurant(config) as any);
    const settings = valuesFor('public.restaurant_settings');
    const branding = valuesFor('public.restaurant_branding');
    const restored = mapRow({ id: 'r1', slug: 'r1', name: 'R1', ...settings, ...branding });
    expect(restored.config).toMatchObject(config);
    expect(restored.timezone).toBe('America/Bogota');
    expect(restored.ordersPaused).toBe(false);
  });
});

describe('PgRestaurantRepository.findBySlug - slug-scoped public read (db-hardening-0008 T4)', () => {
  it('declares the slug in the tenant context, without tenant id or admin role', async () => {
    h.contexts.length = 0;
    await new PgRestaurantRepository().findBySlug('burger-house');
    expect(h.contexts).toEqual([{ restaurantId: null, restaurantSlug: 'burger-house' }]);
  });
});
