-- ============================================================================
-- BURGER-PAGE — STAGING POST-VERIFICATION CLEANUP (14-Table Audit)
-- File: staging_cleanup.sql
-- Description: Cascades deletion of test tenants ('tenant-test-a', 'tenant-test-b')
--              and audits that zero residual rows exist across all 14 tables.
-- ============================================================================

DELETE FROM public.restaurants WHERE id IN ('tenant-test-a', 'tenant-test-b');

-- Verificación de limpieza completa (todas las columnas DEBEN devolver 0)
SELECT 
    (SELECT count(*) FROM public.restaurants WHERE id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_restaurants,
    (SELECT count(*) FROM public.restaurant_hours WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_hours,
    (SELECT count(*) FROM public.users WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_users,
    (SELECT count(*) FROM public.categories WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_categories,
    (SELECT count(*) FROM public.products WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_products,
    (SELECT count(*) FROM public.product_additions WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_additions,
    (SELECT count(*) FROM public.customers WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_customers,
    (SELECT count(*) FROM public.restaurant_order_counters WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_counters,
    (SELECT count(*) FROM public.orders WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_orders,
    (SELECT count(*) FROM public.order_items WHERE order_id NOT IN (SELECT id FROM public.orders)) AS orphaned_order_items,
    (SELECT count(*) FROM public.order_item_additions WHERE order_item_id NOT IN (SELECT id FROM public.order_items)) AS orphaned_item_additions,
    (SELECT count(*) FROM public.order_status_history WHERE order_id NOT IN (SELECT id FROM public.orders)) AS orphaned_order_history,
    (SELECT count(*) FROM public.suppliers WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_suppliers,
    (SELECT count(*) FROM public.inventory WHERE restaurant_id IN ('tenant-test-a', 'tenant-test-b')) AS remaining_inventory;
