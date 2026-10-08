// Multi-tenant seed for local load testing (local only, idempotent).
// Run: node load-tests/seed.mjs   (env: RESTAURANTS=24, LOAD_DATABASE_URL)
// Writes load-tests/data/tenants.json for load-tests/multitenant.js.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(ROOT, 'backend', 'package.json'));
const { Client } = require('pg');

const DB_URL = process.env.LOAD_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_load';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL)) throw new Error('Refusing to seed a non-local database');
const N = Number(process.env.RESTAURANTS || 24);
const PASSWORD = 'LoadTest#2026';
const PRODUCTS_PER_REST = 40;
const NOW = '2025-01-15T10:00:00.000Z';

const CATEGORIES = ['Hamburguesas', 'Perros Calientes', 'Acompanamientos', 'Bebidas', 'Postres'];
const NAMES = [
  ['Hamburguesas', ['Clasica', 'Doble Carne', 'BBQ Bacon', 'Pollo Crujiente', 'Hawaiana', 'Veggie', 'Picante', 'Trufa']],
  ['Perros Calientes', ['Perro Sencillo', 'Perro Suizo', 'Perro Ranchero', 'Perro Gratinado', 'Choripan', 'Perro Mexicano', 'Perro Especial', 'Perro Jumbo']],
  ['Acompanamientos', ['Papas a la Francesa', 'Papas Criollas', 'Yuca Frita', 'Aros de Cebolla', 'Nuggets x8', 'Alitas x6', 'Ensalada Fresca', 'Patacones']],
  ['Bebidas', ['Gaseosa 400ml', 'Limonada Natural', 'Jugo de Mango', 'Cerveza Artesanal', 'Malteada Vainilla', 'Malteada Chocolate', 'Agua Mineral', 'Te Frio']],
  ['Postres', ['Brownie', 'Helado Doble', 'Cheesecake', 'Tres Leches', 'Flan de Caramelo', 'Torta de Zanahoria', 'Churros', 'Waffle con Fruta']],
];
const ADDITIONS = [
  ['Queso Extra', 2000], ['Bacon Extra', 3000], ['Papas a la Francesa', 3500], ['Salsa Trufada', 4000],
  ['Huevo Frito', 1500], ['Aguacate', 2500], ['Cebolla Caramelizada', 1000], ['Jalapenos', 1200],
  ['Pina Asada', 1800], ['Doble Carne', 6000], ['Salsa BBQ', 1000], ['Champinones', 2200],
];

const pad = (n, w = 2) => String(n).padStart(w, '0');
// Deterministic pseudo-random so reruns produce identical rows.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

async function loadHasher() {
  const mod = await import(pathToFileURL(path.join(ROOT, 'backend/dist/infrastructure/security/CryptoPasswordHasher.js')).href);
  return new mod.CryptoPasswordHasher();
}

async function main() {
  const hasher = await loadHasher();
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  const t0 = Date.now();

  const rest = [], cats = [], prods = [], adds = [], users = [], tenants = [];
  for (let i = 1; i <= N; i++) {
    const nn = pad(i);
    const rid = `rest-load-${nn}`;
    rest.push({ id: rid, slug: `load-${nn}`, name: `Load Burger ${nn}` });
    const rand = rng(i * 7919);
    const catIds = CATEGORIES.map((name, c) => {
      const id = `cat-load-${nn}-${c + 1}`;
      cats.push({ id, rid, name, order: c });
      return id;
    });
    const tenant = { slug: `load-${nn}`, restaurantId: rid, adminUsername: `load_admin_${nn}`, productIds: [], additionIds: [], additionsByProduct: {} };
    for (let p = 0; p < PRODUCTS_PER_REST; p++) {
      const c = p % CATEGORIES.length;
      const itemName = NAMES[c][1][Math.floor(p / CATEGORIES.length)];
      const pid = `prod-load-${nn}-${pad(p + 1)}`;
      const price = 8000 + Math.round((rand() * 37000) / 500) * 500; // 8000..45000
      const available = rand() < 0.9;
      prods.push({
        id: pid, rid, cat: catIds[c], name: itemName, price, available,
        description: `${itemName} preparado al momento con ingredientes frescos`,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
        popular: rand() < 0.15, isNew: rand() < 0.1, prep: 5 + Math.floor(rand() * 20), order: Math.floor(p / CATEGORIES.length),
      });
      // Link 2..5 of the 12 catalog additions to this product (product-specific rows).
      const count = 2 + Math.floor(rand() * 4);
      const picks = new Set();
      while (picks.size < count) picks.add(Math.floor(rand() * ADDITIONS.length));
      const ids = [];
      for (const a of picks) {
        const aid = `add-load-${nn}-${pad(p + 1)}-${pad(a + 1)}`;
        adds.push({ id: aid, rid, pid, name: ADDITIONS[a][0], price: ADDITIONS[a][1], order: a });
        ids.push(aid);
      }
      tenant.additionsByProduct[pid] = ids;
      if (available) tenant.productIds.push(pid);
      tenant.additionIds.push(...ids);
    }
    users.push({ id: `usr-load-admin-${nn}`, username: tenant.adminUsername, rid, hash: await hasher.hash(PASSWORD) });
    tenants.push(tenant);
  }

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO public.restaurants (id, slug, name, tagline, whatsapp_number, is_active, created_at, updated_at)
       SELECT id, slug, name, 'Load test tenant', '573001234567', TRUE, $4::timestamptz, $4::timestamptz
       FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, slug, name) ON CONFLICT DO NOTHING`,
      [rest.map((r) => r.id), rest.map((r) => r.slug), rest.map((r) => r.name), NOW]
    );
    const rids = rest.map((r) => r.id);
    await db.query(
      `INSERT INTO public.restaurant_settings (restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount, estimated_delivery_time, timezone, orders_paused, created_at, updated_at)
       SELECT id, 'COP', '$', 5000, 0, '30 - 45 min', 'America/Bogota', FALSE, $2::timestamptz, $2::timestamptz FROM unnest($1::text[]) AS id
       ON CONFLICT (restaurant_id) DO UPDATE SET orders_paused = FALSE`,
      [rids, NOW]
    );
    await db.query(
      `INSERT INTO public.restaurant_branding (restaurant_id, created_at, updated_at)
       SELECT id, $2::timestamptz, $2::timestamptz FROM unnest($1::text[]) AS id ON CONFLICT (restaurant_id) DO NOTHING`,
      [rids, NOW]
    );
    // Open 24h every day (00:00 - 00:00 crosses midnight), as in the demo seed.
    await db.query(
      `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
       SELECT 'oh-' || r || '-' || d, r, d, '00:00', '00:00' FROM unnest($1::text[]) AS r CROSS JOIN generate_series(0, 6) AS d
       ON CONFLICT DO NOTHING`,
      [rids]
    );
    await db.query(
      `INSERT INTO public.restaurant_order_counters (restaurant_id, last_number)
       SELECT id, 0 FROM unnest($1::text[]) AS id ON CONFLICT (restaurant_id) DO NOTHING`,
      [rids]
    );
    await db.query(
      `INSERT INTO public.categories (id, restaurant_id, name, display_order, is_active, created_at, updated_at)
       SELECT id, rid, name, ord, TRUE, $5::timestamptz, $5::timestamptz FROM unnest($1::text[], $2::text[], $3::text[], $4::int[]) AS t(id, rid, name, ord)
       ON CONFLICT DO NOTHING`,
      [cats.map((c) => c.id), cats.map((c) => c.rid), cats.map((c) => c.name), cats.map((c) => c.order), NOW]
    );
    await db.query(
      `INSERT INTO public.products (id, restaurant_id, category_id, name, description, price, image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, created_at, updated_at)
       SELECT id, rid, cat, name, descr, price, img, av, pop, nw, prep, ord, $13::timestamptz, $13::timestamptz
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::text[], $8::bool[], $9::bool[], $10::bool[], $11::int[], $12::int[])
         AS t(id, rid, cat, name, descr, price, img, av, pop, nw, prep, ord)
       ON CONFLICT DO NOTHING`,
      [prods.map((p) => p.id), prods.map((p) => p.rid), prods.map((p) => p.cat), prods.map((p) => p.name), prods.map((p) => p.description),
       prods.map((p) => p.price), prods.map((p) => p.image), prods.map((p) => p.available), prods.map((p) => p.popular),
       prods.map((p) => p.isNew), prods.map((p) => p.prep), prods.map((p) => p.order), NOW]
    );
    await db.query(
      `INSERT INTO public.product_additions (id, restaurant_id, product_id, name, price, is_available, display_order, created_at, updated_at)
       SELECT id, rid, pid, name, price, TRUE, ord, $6::timestamptz, $6::timestamptz FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $7::int[])
         AS t(id, rid, pid, name, price, ord)
       ON CONFLICT DO NOTHING`,
      [adds.map((a) => a.id), adds.map((a) => a.rid), adds.map((a) => a.pid), adds.map((a) => a.name), adds.map((a) => a.price), NOW, adds.map((a) => a.order)]
    );
    // DO NOTHING keeps existing hashes valid on reruns (all share PASSWORD anyway).
    await db.query(
      `INSERT INTO public.users (id, username, password_hash, role, restaurant_id, is_active, created_at, updated_at)
       SELECT id, username, hash, 'restaurant_admin', rid, TRUE, $4::timestamptz, $4::timestamptz FROM unnest($1::text[], $2::text[], $3::text[], $5::text[])
         AS t(id, username, rid, hash)
       ON CONFLICT DO NOTHING`,
      [users.map((u) => u.id), users.map((u) => u.username), users.map((u) => u.rid), NOW, users.map((u) => u.hash)]
    );
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  const counts = (
    await db.query(
      `SELECT (SELECT count(*) FROM restaurants WHERE id LIKE 'rest-load-%') AS restaurants,
              (SELECT count(*) FROM categories WHERE id LIKE 'cat-load-%') AS categories,
              (SELECT count(*) FROM products WHERE id LIKE 'prod-load-%') AS products,
              (SELECT count(*) FROM products WHERE id LIKE 'prod-load-%' AND is_available) AS available_products,
              (SELECT count(*) FROM product_additions WHERE id LIKE 'add-load-%') AS additions,
              (SELECT count(*) FROM users WHERE username LIKE 'load\\_admin\\_%') AS admins`
    )
  ).rows[0];
  await db.end();

  mkdirSync(path.join(ROOT, 'load-tests/data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'load-tests/data/tenants.json'), JSON.stringify({ password: PASSWORD, tenants }, null, 1));
  console.log(`Seeded ${N} tenants in ${Date.now() - t0}ms:`, counts);
  console.log('Wrote load-tests/data/tenants.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
