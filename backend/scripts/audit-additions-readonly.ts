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
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function runAudit() {
  console.log('🔍 Running Read-Only Additions Audit against Supabase...');
  console.log(`URL: ${supabaseUrl}\n`);

  // 1. Check existing product_additions table
  const { data: relationalAdditions, error: relErr } = await supabase
    .from('product_additions')
    .select('*');

  if (relErr) {
    console.log('ℹ️ Table `product_additions` query returned:', relErr.message);
  } else {
    console.log(`📁 Table \`product_additions\` exists: ${relationalAdditions?.length || 0} rows found.`);
    if (relationalAdditions && relationalAdditions.length > 0) {
      console.table(relationalAdditions);
    }
  }

  // 2. Fetch products and inspect flat additions column
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, restaurant_id, name, additions');

  if (prodErr) {
    console.error('❌ Error fetching products:', prodErr);
    return;
  }

  const productsWithAdditions = (products || []).filter(p => {
    if (!p.additions) return false;
    if (Array.isArray(p.additions) && p.additions.length === 0) return false;
    if (typeof p.additions === 'string' && (p.additions === '[]' || p.additions === '')) return false;
    return true;
  });

  console.log(`\n🍔 Products count: ${products?.length || 0}`);
  console.log(`🍔 Products with non-empty additions: ${productsWithAdditions.length}`);

  if (productsWithAdditions.length > 0) {
    console.table(productsWithAdditions.map(p => ({
      id: p.id,
      restaurant_id: p.restaurant_id,
      name: p.name,
      additions_type: typeof p.additions,
      additions_raw: JSON.stringify(p.additions),
    })));
  }
}

runAudit().catch(console.error);
