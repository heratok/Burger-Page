-- ============================================================================
-- 0000000000010_restaurant_tables.down.sql
-- Restores the 0009 state. The tables of every restaurant and the table
-- reference/label stored on orders are lost (orders themselves are kept).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T2. orders.table_id / orders.table_label removed ────────────────────────
DROP INDEX IF EXISTS public.idx_orders_table;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_table_tenant;
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS table_id,
    DROP COLUMN IF EXISTS table_label;

-- ── T1. restaurant_tables removed ───────────────────────────────────────────
-- Dropping the table also drops its policy, trigger, grants and indexes.
DROP TABLE IF EXISTS public.restaurant_tables;
