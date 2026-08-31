/**
 * Manual verification script — run against a REAL Postgres/Supabase instance
 * before merging feature/security-hardening to main.
 *
 * Usage (from repo root):
 *   npx tsx --env-file=backend/.env backend/scripts/verify-postgres-constraints.ts
 *
 * Covers:
 *   1. Composite UNIQUE upsert — products (id, restaurant_id)
 *   2. Composite UNIQUE upsert — customers (id, restaurant_id)
 *   3. Composite UNIQUE upsert — inventory_items (id, restaurant_id)
 *   4. Cross-tenant upsert isolation (same id, different restaurant_id must NOT overwrite)
 *   5. adjustStock RPC — decrement with sufficient stock
 *   6. adjustStock RPC — decrement with insufficient stock (returns 0 rows, not an error)
 *   7. adjustStock RPC — restock (delta > 0) from quantity = 0 (must NOT be blocked)
 *   8. adjustStock RPC — cross-tenant call (returns 0 rows)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  OK  ${label}`);
  passed++;
}

function fail(label: string, detail: unknown) {
  console.error(`  FAIL  ${label}`);
  console.error('        ', detail instanceof Error ? detail.message : detail);
  failed++;
}

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

const RESTAURANT_A = 'verify-rest-a';
const RESTAURANT_B = 'verify-rest-b';

async function seedRestaurant(id: string) {
  const { error } = await supabase.from('restaurants').upsert(
    { id, name: `Verify Restaurant ${id}`, slug: id, is_active: true },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`Failed to seed restaurant '${id}': ${error.message}`);
}

async function cleanup() {
  for (const restaurantId of [RESTAURANT_A, RESTAURANT_B]) {
    for (const table of ['products', 'customers', 'inventory_items']) {
      await supabase.from(table).delete().eq('restaurant_id', restaurantId);
    }
    await supabase.from('restaurants').delete().eq('id', restaurantId);
  }
}

// ─── Product tests ────────────────────────────────────────────────────────────

async function testProductUpsert() {
  console.log('\n  Products — UNIQUE(id, restaurant_id)');
  const productId = `prod_${randomUUID()}`;

  await check('upsert creates product in restaurant A', async () => {
    const { error } = await supabase.from('products').upsert(
      { id: productId, restaurant_id: RESTAURANT_A, name: 'Verify Burger', category_name: 'verify', price: 10000, is_available: true, is_popular: false, is_new: false, display_order: 1, preparation_time_minutes: 10 },
      { onConflict: 'id,restaurant_id' }
    );
    if (error) throw error;
  });

  await check('upsert updates same product idempotently (same id + restaurant)', async () => {
    const { error } = await supabase.from('products').upsert(
      { id: productId, restaurant_id: RESTAURANT_A, name: 'Verify Burger UPDATED', category_name: 'verify', price: 12000, is_available: true, is_popular: false, is_new: false, display_order: 1, preparation_time_minutes: 10 },
      { onConflict: 'id,restaurant_id' }
    );
    if (error) throw error;
    const { data } = await supabase.from('products').select('name').eq('id', productId).eq('restaurant_id', RESTAURANT_A).single();
    if (data?.name !== 'Verify Burger UPDATED') throw new Error(`name='${data?.name}' (expected 'Verify Burger UPDATED')`);
  });

  await check('cross-tenant upsert (same id, different restaurant_id) is rejected by PK and does NOT overwrite restaurant A', async () => {
    // When onConflict is 'id,restaurant_id', an upsert with an existing id but different restaurant_id
    // does not match the composite conflict target. Postgres therefore attempts an INSERT,
    // which is safely blocked by PRIMARY KEY(id) (code 23505), preventing cross-tenant data overwrite.
    const { error } = await supabase.from('products').upsert(
      { id: productId, restaurant_id: RESTAURANT_B, name: 'Hijack Attempt', category_name: 'verify', price: 1, is_available: true, is_popular: false, is_new: false, display_order: 1, preparation_time_minutes: 1 },
      { onConflict: 'id,restaurant_id' }
    );
    // Error 23505 is expected because id is globally unique and cannot be hijacked
    if (error && error.code !== '23505') throw error;

    // Verify restaurant A's data is intact and was NOT overwritten
    const { data } = await supabase.from('products').select('name').eq('id', productId).eq('restaurant_id', RESTAURANT_A).single();
    if (data?.name !== 'Verify Burger UPDATED') throw new Error(`Restaurant A was overwritten! name='${data?.name}'`);
  });
}

// ─── Customer tests ───────────────────────────────────────────────────────────

async function testCustomerUpsert() {
  console.log('\n  Customers — UNIQUE(id, restaurant_id)');
  const customerId = `cust_${randomUUID()}`;

  await check('upsert creates customer in restaurant A', async () => {
    const { error } = await supabase.from('customers').upsert(
      { id: customerId, restaurant_id: RESTAURANT_A, name: 'Verify Customer', phone: '3001234567' },
      { onConflict: 'id,restaurant_id' }
    );
    if (error) throw error;
  });

  await check('cross-tenant upsert (same id, different restaurant_id) is rejected by PK and does NOT overwrite restaurant A', async () => {
    const { error } = await supabase.from('customers').upsert(
      { id: customerId, restaurant_id: RESTAURANT_B, name: 'Hijack Attempt', phone: '0000000000' },
      { onConflict: 'id,restaurant_id' }
    );
    if (error && error.code !== '23505') throw error;

    const { data } = await supabase.from('customers').select('name').eq('id', customerId).eq('restaurant_id', RESTAURANT_A).single();
    if (data?.name !== 'Verify Customer') throw new Error(`Restaurant A was overwritten! name='${data?.name}'`);
  });
}

// ─── Inventory + adjustStock tests ───────────────────────────────────────────

async function testInventoryAndAdjustStock() {
  console.log('\n  Inventory — UNIQUE(id, restaurant_id) + adjust_inventory_stock RPC');
  const itemId = `inv_${randomUUID()}`;

  await check('upsert creates inventory item with current_stock = 0', async () => {
    const { error } = await supabase.from('inventory_items').upsert(
      { id: itemId, restaurant_id: RESTAURANT_A, name: 'Verify Cheese', category: 'ingredients', current_stock: 0, unit: 'kg', min_stock_alert: 5, cost_per_unit: 25000 },
      { onConflict: 'id,restaurant_id' }
    );
    if (error) throw error;
  });

  await check('adjustStock delta=+50 (restock) from current_stock=0 is NOT blocked', async () => {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', { p_id: itemId, p_restaurant_id: RESTAURANT_A, p_delta: 50 });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    if (rows.length === 0) throw new Error('RPC returned 0 rows — restock from 0 was incorrectly blocked by the stock guard');
    if (Number(rows[0].current_stock) !== 50) throw new Error(`current_stock=${rows[0].current_stock} (expected 50)`);
  });

  await check('adjustStock delta=-15 (decrement) with sufficient stock succeeds', async () => {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', { p_id: itemId, p_restaurant_id: RESTAURANT_A, p_delta: -15 });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    if (rows.length === 0) throw new Error('RPC returned 0 rows — decrement with sufficient stock failed');
    if (Number(rows[0].current_stock) !== 35) throw new Error(`current_stock=${rows[0].current_stock} (expected 35)`);
  });

  await check('adjustStock delta=-100 (decrement) with insufficient stock returns 0 rows (not an error)', async () => {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', { p_id: itemId, p_restaurant_id: RESTAURANT_A, p_delta: -100 });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    if (rows.length !== 0) throw new Error(`Expected 0 rows (stock guard), got ${rows.length}`);
  });

  await check('adjustStock cross-tenant call returns 0 rows', async () => {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', { p_id: itemId, p_restaurant_id: RESTAURANT_B, p_delta: 10 });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    if (rows.length !== 0) throw new Error(`Expected 0 rows (tenant isolation), got ${rows.length}`);
  });

  await check('cross-tenant upsert (same id, different restaurant_id) is rejected by PK and does NOT overwrite restaurant A', async () => {
    const { error } = await supabase.from('inventory_items').upsert(
      { id: itemId, restaurant_id: RESTAURANT_B, name: 'Hijack Attempt', category: 'ingredients', current_stock: 9999, unit: 'kg', min_stock_alert: 5, cost_per_unit: 1 },
      { onConflict: 'id,restaurant_id' }
    );
    if (error && error.code !== '23505') throw error;
    const { data } = await supabase.from('inventory_items').select('name, current_stock').eq('id', itemId).eq('restaurant_id', RESTAURANT_A).single();
    if (data?.name !== 'Verify Cheese') throw new Error(`Restaurant A inventory name was overwritten! name='${data?.name}'`);
    if (Number(data?.current_stock) === 9999) throw new Error('Restaurant A current_stock was overwritten to 9999!');
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Verifying Postgres constraints against real Supabase instance...');
  console.log(`URL: ${url}\n`);

  await seedRestaurant(RESTAURANT_A);
  await seedRestaurant(RESTAURANT_B);

  try {
    await testProductUpsert();
    await testCustomerUpsert();
    await testInventoryAndAdjustStock();
  } finally {
    console.log('\nCleaning up test data...');
    await cleanup();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\nVERIFICATION FAILED — DO NOT MERGE TO MAIN\n');
    process.exit(1);
  } else {
    console.log('\nAll checks passed — safe to merge\n');
  }
}

main().catch((e) => {
  console.error('Fatal error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
