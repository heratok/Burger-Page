-- ============================================================================
-- 0000000000019_order_type.up.sql
-- delivery-pickup-orders T1 (S1-S3): orders.order_type as a first-class column
-- (mirrors database/01_schema.sql).
--
--   domicilio — entrega a domicilio. Comportamiento histórico y DEFAULT, así
--               que todo llamador existente (storefront, POS, create_order_atomic)
--               sigue siendo una orden de domicilio sin cambiar una línea.
--   recoger   — el cliente recoge el pedido en el local: la tarifa de envío
--               es 0 y final_total = subtotal.
--
-- La firma de public.create_order_atomic NO cambia (ningún p_order_type): la
-- aplicación escribe el tipo en la misma transacción, después del INSERT del
-- RPC, y el DEFAULT cubre a los pedidos de domicilio.
--
-- Idempotente y reversible con 0000000000019_order_type.down.sql.
-- node-pg-migrate envuelve el archivo en una transacción.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T1. columna order_type con DEFAULT de domicilio ─────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'domicilio';

-- ── T2. solo dos valores válidos ────────────────────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;
ALTER TABLE public.orders
    ADD CONSTRAINT chk_orders_order_type
    CHECK (order_type IN ('domicilio', 'recoger'));

COMMENT ON COLUMN public.orders.order_type IS
    'Tipo de pedido: domicilio (entrega, DEFAULT histórico) o recoger (retiro en el local, sin tarifa de envío). Nunca se deduce de texto libre.';
