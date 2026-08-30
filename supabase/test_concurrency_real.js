import pg from 'pg';
const { Pool } = pg;

/**
 * BURGER-PAGE — Real Multi-Session Concurrency Test (20 Parallel Connections)
 * Usage: DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" node test_concurrency_real.js
 */
async function runRealConcurrencyTest() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL o POSTGRES_URL debe estar configurada en el entorno.');
    console.log('Ejemplo: DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" node supabase/test_concurrency_real.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 25,
    ssl: { rejectUnauthorized: false }
  });

  const RESTAURANT_ID = 'tenant-test-a';
  const NUM_CONCURRENT_ORDERS = 20;

  console.log('================================================================');
  console.log(`INICIANDO PRUEBA DE CONCURRENCIA REAL: ${NUM_CONCURRENT_ORDERS} CONEXIONES PARALELAS`);
  console.log('================================================================');

  try {
    // 1. Verificar existencia del restaurante y producto base
    const client = await pool.connect();
    const restRes = await client.query('SELECT * FROM public.restaurants WHERE id = $1', [RESTAURANT_ID]);
    if (restRes.rowCount === 0) {
      console.log('Creando restaurante de prueba para concurrencia...');
      await client.query(`
        INSERT INTO public.restaurants (id, slug, name, delivery_fee, min_order_amount, is_active)
        VALUES ($1, 'craft-staging', 'Burger Craft Staging', 5000.00, 0.00, true)
        ON CONFLICT (id) DO NOTHING
      `, [RESTAURANT_ID]);
    }

    const prodRes = await client.query('SELECT * FROM public.products WHERE restaurant_id = $1 LIMIT 1', [RESTAURANT_ID]);
    let productId;
    if (prodRes.rowCount === 0) {
      productId = 'prod-conc-base';
      await client.query(`
        INSERT INTO public.products (id, restaurant_id, category_name, name, price, is_available)
        VALUES ($1, $2, 'Hamburguesas', 'Burger Concurrente', 25000.00, true)
        ON CONFLICT (id, restaurant_id) DO NOTHING
      `, [productId, RESTAURANT_ID]);
    } else {
      productId = prodRes.rows[0].id;
    }
    client.release();

    // 2. Disparar 20 órdenes simultáneas desde 20 sesiones independientes
    console.log(`Disparando ${NUM_CONCURRENT_ORDERS} llamadas simultáneas a create_order_atomic...`);
    const startTime = Date.now();

    const promises = Array.from({ length: NUM_CONCURRENT_ORDERS }, async (_, i) => {
      const dedicatedClient = await pool.connect();
      try {
        const orderId = `ord-real-conc-${Date.now()}-${i + 1}`;
        const items = JSON.stringify([
          { id: `item-conc-${i + 1}`, product_id: productId, quantity: 1 }
        ]);

        const res = await dedicatedClient.query(`
          SELECT public.create_order_atomic(
            $1, $2, NULL, 'Efectivo', 30000.00, 0.00, $3, $4::jsonb
          ) AS created_order
        `, [orderId, RESTAURANT_ID, `Orden Concurrente Real #${i + 1}`, items]);

        return res.rows[0].created_order;
      } finally {
        dedicatedClient.release();
      }
    });

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`\n✓ ${results.length} órdenes procesadas en ${duration}ms.`);

    // 3. Consultar la base de datos para auditar los order_numbers asignados
    const auditClient = await pool.connect();
    const auditRes = await auditClient.query(`
      SELECT id, order_number, created_at
      FROM public.orders
      WHERE restaurant_id = $1 AND id LIKE 'ord-real-conc-%'
      ORDER BY order_number ASC
    `, [RESTAURANT_ID]);
    auditClient.release();

    const orderNumbers = auditRes.rows.map(r => r.order_number);
    const uniqueNumbers = new Set(orderNumbers);

    console.log(`Números de orden asignados: [${orderNumbers.join(', ')}]`);
    console.log(`Total registros en BD: ${orderNumbers.length}`);
    console.log(`Total números únicos: ${uniqueNumbers.size}`);

    if (uniqueNumbers.size !== NUM_CONCURRENT_ORDERS) {
      console.error(`❌ FALLÓ LA PRUEBA: Se detectaron colisiones o duplicados (${uniqueNumbers.size} únicos de ${NUM_CONCURRENT_ORDERS}).`);
      process.exit(1);
    }

    console.log('================================================================');
    console.log('✅ GARANTÍA DEMOSTRADA EN POSTGRESQL REAL:');
    console.log('- 20 conexiones independientes concurrentes');
    console.log('- 0 colisiones / 0 duplicados en order_number');
    console.log('- Row locking atómico en restaurant_order_counters validado');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Error durante la prueba de concurrencia:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runRealConcurrencyTest();
