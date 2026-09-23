-- ============================================================================
-- 0000000000004_composite_tenant_fks.down.sql
-- Reversa de WU-1b: restaura los FKs single-column originales (nombres auto
-- de PostgreSQL), elimina los UNIQUE (id, restaurant_id) agregados que no
-- pre-existían (uq_customers_id_restaurant NO se toca: ya era parte del
-- canon antes de esta migración) y restaura el cuerpo original del trigger
-- update_customer_order_metrics (agregado sin filtro de restaurant).
--
-- Idempotente: mismo patrón DROP CONSTRAINT IF EXISTS + ADD; los FKs
-- compuestos se DROPean ANTES de los UNIQUE que referencian.
-- ============================================================================

-- ── 1. Drop de los FKs compuestos tenant-scoped ─────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_customer_tenant;
ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS fk_order_status_history_order_tenant;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order_tenant;
ALTER TABLE public.order_item_additions DROP CONSTRAINT IF EXISTS fk_order_item_additions_order_item_tenant;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS fk_products_category_tenant;

-- ── 2. Drop de los UNIQUE (id, restaurant_id) agregados por el UP ───────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS uq_orders_id_restaurant;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS uq_categories_id_restaurant;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS uq_order_items_id_restaurant;

-- ── 3. Restauración de los FKs single-column originales ─────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id)
    ON DELETE SET NULL;

ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_order_id_fkey;
ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id)
    ON DELETE CASCADE;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id)
    ON DELETE CASCADE;

ALTER TABLE public.order_item_additions DROP CONSTRAINT IF EXISTS order_item_additions_order_item_id_fkey;
ALTER TABLE public.order_item_additions ADD CONSTRAINT order_item_additions_order_item_id_fkey
    FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
    ON DELETE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id)
    ON DELETE SET NULL;

-- ── 4. Trigger: cuerpo original (agregado sin filtro de restaurant) ─────────
CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_id TEXT;
    v_total_orders INTEGER;
    v_total_spent NUMERIC(12, 2);
    v_last_order_date TIMESTAMPTZ;
BEGIN
    -- NEW is an unassigned record in DELETE triggers: pick the row
    -- source by operation before touching any column (previously this
    -- COALESCE ran unconditionally and every DELETE on public.orders
    -- raised 'record "new" is not assigned yet').
    IF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSE
        v_customer_id := NEW.customer_id;
    END IF;
    IF v_customer_id IS NULL THEN
        RETURN NEW;
    END IF;

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
      AND status != 'cancelled';

    UPDATE public.customers
    SET 
        total_orders = v_total_orders,
        total_spent = v_total_spent,
        last_order_date = v_last_order_date,
        updated_at = NOW()
    WHERE id = v_customer_id;

    RETURN NEW;
END;
$$;