-- ============================================================================
-- 0000000000002_fix_drift_orders_products_rpc.up.sql
-- Corrección de drift de base de datos contra el canon database/01_schema.sql:
-- 1. Idempotencia SUS-19: agregar client_order_id e índice único en orders.
-- 2. Eliminar columna desnormalizada category_name en products (resuelto por JOIN 3NF).
-- 3. Eliminar sobrecarga obsoleta de 8 parámetros de create_order_atomic.
-- ============================================================================

-- 1. orders.client_order_id + uq_orders_client_order_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_order_id TEXT;

COMMENT ON COLUMN public.orders.client_order_id IS 'Idempotencia SUS-19: correlación del cliente; único por (restaurant_id, client_order_id).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_client_order_id
    ON public.orders (restaurant_id, client_order_id);

-- 2. products.category_name (drop para evitar fallos de NOT NULL en PgProductRepository)
ALTER TABLE public.products DROP COLUMN IF EXISTS category_name;

-- 3. Eliminar sobrecarga vieja (8 argumentos) de create_order_atomic para evitar ambigüedad en RPC / PostgREST
DROP FUNCTION IF EXISTS public.create_order_atomic(
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    NUMERIC,
    NUMERIC,
    TEXT,
    JSONB
);
