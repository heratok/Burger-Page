-- ============================================================================
-- 0000000000008_db_hardening.up.sql
-- Database hardening from the schema audit (mirrors database/01_schema.sql):
--   T2  update_customer_order_metrics locks the customer row before aggregating.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
--
-- Requires PostgreSQL 15+.
-- ============================================================================

-- Fail fast instead of queueing behind long-running transactions while this
-- migration holds (or waits for) table locks. Scoped to this transaction.
SET LOCAL lock_timeout = '15s';

-- ── T2. Customer metrics: lock the customer row before aggregating ──────────
CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_ids TEXT[];
    v_customer_id TEXT;
    v_restaurant_id TEXT;
    v_total_orders INTEGER;
    v_total_spent NUMERIC(12, 2);
    v_last_order_date TIMESTAMPTZ;
BEGIN
    -- NEW is an unassigned record in DELETE triggers: pick the row
    -- source by operation before touching any column (previously this
    -- COALESCE ran unconditionally and every DELETE on public.orders
    -- raised 'record "new" is not assigned yet').
    -- WU-1b (M2/M3): el agregado se filtra por el restaurante de la orden
    -- disparadora (fuente OLD/NEW según operación, igual que los customer ids)
    -- para que las ventas de un tenant jamás recomputen los totales de un
    -- customer de otro tenant, aunque hubiera entrado un link cross-tenant
    -- antes del fix de FKs compuestos.
    -- WU-4 (4.4): cuando customer_id cambia A -> B (o A -> NULL) se recomputan
    -- AMBOS clientes; antes solo se recomputaba COALESCE(NEW, OLD) y el
    -- cliente anterior conservaba totales obsoletos.
    IF TG_OP = 'DELETE' THEN
        v_customer_ids := ARRAY[OLD.customer_id];
        v_restaurant_id := OLD.restaurant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_ids := ARRAY[NEW.customer_id, OLD.customer_id];
        v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
    ELSE
        v_customer_ids := ARRAY[NEW.customer_id];
        v_restaurant_id := NEW.restaurant_id;
    END IF;

    -- db-hardening-0008 (T2): lock the customer row BEFORE aggregating. Under
    -- READ COMMITTED every statement takes a fresh snapshot, so once the lock is
    -- granted the aggregate below sees every order committed by the transaction
    -- that held it. Without the lock, two concurrent order writes for the same
    -- customer aggregate stale snapshots and the last UPDATE silently wins
    -- (lost update). ORDER BY gives a stable lock order when an UPDATE moves an
    -- order between two customers, so two such transactions cannot deadlock.
    FOR v_customer_id IN
        SELECT DISTINCT c FROM unnest(v_customer_ids) AS c WHERE c IS NOT NULL ORDER BY c
    LOOP
        PERFORM 1
        FROM public.customers
        WHERE id = v_customer_id
          AND restaurant_id = v_restaurant_id
        FOR UPDATE;

        SELECT
            COUNT(*),
            COALESCE(SUM(final_total), 0.00),
            MAX(created_at)
        INTO
            v_total_orders,
            v_total_spent,
            v_last_order_date
        FROM public.orders
        WHERE customer_id = v_customer_id
          AND restaurant_id = v_restaurant_id
          AND status != 'cancelled';

        UPDATE public.customers
        SET
            total_orders = v_total_orders,
            total_spent = v_total_spent,
            last_order_date = v_last_order_date,
            updated_at = NOW()
        WHERE id = v_customer_id
          AND restaurant_id = v_restaurant_id;
    END LOOP;

    RETURN NEW;
END;
$$;
