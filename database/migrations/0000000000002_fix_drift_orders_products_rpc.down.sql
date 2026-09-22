-- ============================================================================
-- 0000000000002_fix_drift_orders_products_rpc.down.sql
-- ============================================================================

DROP INDEX IF EXISTS public.uq_orders_client_order_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_order_id;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_name TEXT;
