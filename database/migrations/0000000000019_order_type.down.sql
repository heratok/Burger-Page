-- ============================================================================
-- 0000000000019_order_type.down.sql
-- Restaura el estado previo: la columna order_type desaparece, así que todos
-- los pedidos vuelven a leerse como domicilio (el comportamiento histórico).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T2. constraint de valores válidos eliminado ─────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;

-- ── T1. columna order_type eliminada ────────────────────────────────────────
ALTER TABLE public.orders DROP COLUMN IF EXISTS order_type;
