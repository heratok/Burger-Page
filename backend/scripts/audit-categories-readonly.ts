import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const paths = [
    resolve(process.cwd(), 'backend/.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function runAudit() {
  console.log('🔍 Running Read-Only Category & Products Audit against Supabase...');
  console.log(`URL: ${supabaseUrl}\n`);

  // 1. Fetch all restaurants
  const { data: restaurants, error: restErr } = await supabase
    .from('restaurants')
    .select('*');

  if (restErr) {
    console.error('❌ Error fetching restaurants:', restErr);
    return;
  }

  console.log(`📋 Found ${restaurants?.length || 0} restaurants:`);
  for (const r of restaurants || []) {
    console.log(`  - [${r.id}] ${r.name} (slug: ${r.slug}, active: ${r.is_active})`);
  }

  // 2. Check if a dedicated 'categories' table exists in public schema
  const { data: catTable, error: catTableErr } = await supabase
    .from('categories')
    .select('*')
    .limit(10);

  if (catTableErr) {
    console.log('\nℹ️ Table `categories`: Not found or query returned:', catTableErr.message);
  } else {
    console.log(`\n📁 Table \`categories\` exists! Found ${catTable?.length || 0} rows:`, catTable);
  }

  // 3. Fetch all products
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*');

  if (prodErr) {
    console.error('❌ Error fetching products:', prodErr);
    process.exit(1);
  }

  console.log(`\n🍔 Found ${products?.length || 0} total products in database:`);
  
  const auditReport = {
    totalProducts: products?.length || 0,
    productsWithCategoryNameOnly: 0,
    productsWithNullCategoryId: 0,
    productsWithValidCategoryId: 0,
    productsWithOrphanCategoryId: 0,
    details: [] as any[],
  };

  for (const p of products || []) {
    const hasCatId = 'category_id' in p && p.category_id !== null;
    const catId = p.category_id;
    const catName = p.category_name;

    if (!hasCatId) {
      auditReport.productsWithNullCategoryId++;
    }

    auditReport.details.push({
      id: p.id,
      restaurant_id: p.restaurant_id,
      name: p.name,
      category_name: catName,
      category_id: catId ?? null,
      price: p.price,
      is_available: p.is_available,
      additions: p.additions,
    });
  }

  // 4. Inspect columns of categories and products table via RPC or direct insert test
  const { data: catSample, error: catSampleErr } = await supabase
    .from('categories')
    .select('*');
  console.log('\n🔎 Categories table status:', { data: catSample, error: catSampleErr });

  const { data: prodSample, error: prodSampleErr } = await supabase
    .from('products')
    .select('*');
  console.log('\n🔎 Products table status:', { data: prodSample, error: prodSampleErr });
}

runAudit().catch(console.error);
