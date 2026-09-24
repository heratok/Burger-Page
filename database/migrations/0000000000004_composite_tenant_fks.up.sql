-- ============================================================================
-- 0000000000004_composite_tenant_fks.up.sql
-- WU-1b (M2/M3 del feature tenant-isolation-hardening): FKs compuestos
-- tenant-scoped + trigger de métricas de cliente filtrado por restaurant_id.
-- Cada FK hijo->padre pasa de columna única a (ref_id, restaurant_id) contra
-- UNIQUE (id, restaurant_id) del padre, replicando el patrón ya existente de
-- product_additions -> products(id, restaurant_id) (01_schema.sql).
--
-- Idempotente: cada FK se DROP CONSTRAINT IF EXISTS (nombres nuevos y viejos)
-- antes del ADD. Los UNIQUE nuevos se crean con DO + pg_constraint (no se
-- pueden DROP/re-ADD como los FKs: una vez creados, los FKs compuestos los
-- referencian y un DROP rompería la re-ejecución).
--
-- Nota sobre datos existentes: si la DB ya contiene filas cross-tenant
-- (p.ej. un order_items de tenant A apuntando a una orden de tenant B), el
-- ADD del FK compuesto fallará en esa DB; hay que corregir esas filas antes
-- de migrar. 01_schema.sql se re-aplica a esquemas frescos en la suite de
-- integración, así que el schema canónico no depende de esta migración.
-- ============================================================================

-- ── 1. UNIQUE (id, restaurant_id) targets de los FKs compuestos ────────────
-- customers ya tiene uq_customers_id_restaurant en el canon (guarda
-- defensiva contra drift en DBs creadas antes de ese constraint).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_customers_id_restaurant'
          AND conrelid = 'public.customers'::regclass
    ) THEN
        ALTER TABLE public.customers
            ADD CONSTRAINT uq_customers_id_restaurant UNIQUE (id, restaurant_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_orders_id_restaurant'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT uq_orders_id_restaurant UNIQUE (id, restaurant_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_categories_id_restaurant'
          AND conrelid = 'public.categories'::regclass
    ) THEN
        ALTER TABLE public.categories
            ADD CONSTRAINT uq_categories_id_restaurant UNIQUE (id, restaurant_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_order_items_id_restaurant'
          AND conrelid = 'public.order_items'::regclass
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT uq_order_items_id_restaurant UNIQUE (id, restaurant_id);
    END IF;
END
$$;

-- ── 2. Drop de los FKs single-column originales (nombres auto de PostgreSQL) ──
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_customer_tenant;

ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_order_id_fkey;
ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS fk_order_status_history_order_tenant;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order_tenant;

ALTER TABLE public.order_item_additions DROP CONSTRAINT IF EXISTS order_item_additions_order_item_id_fkey;
ALTER TABLE public.order_item_additions DROP CONSTRAINT IF EXISTS fk_order_item_additions_order_item_tenant;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS fk_products_category_tenant;

-- ── 3. FKs compuestos tenant-scoped (ref_id, restaurant_id) ─────────────────
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_customer_tenant
    FOREIGN KEY (customer_id, restaurant_id)
    REFERENCES public.customers(id, restaurant_id)
    -- PG15+ column list: anula SOLO customer_id al borrar el customer
    -- (comportamiento previo); un SET NULL sin lista anularía también
    -- restaurant_id y fallaría por NOT NULL con órdenes existentes.
    ON DELETE SET NULL (customer_id);

ALTER TABLE public.order_status_history ADD CONSTRAINT fk_order_status_history_order_tenant
    FOREIGN KEY (order_id, restaurant_id)
    REFERENCES public.orders(id, restaurant_id)
    ON DELETE CASCADE;

ALTER TABLE public.order_items ADD CONSTRAINT fk_order_items_order_tenant
    FOREIGN KEY (order_id, restaurant_id)
    REFERENCES public.orders(id, restaurant_id)
    ON DELETE CASCADE;

ALTER TABLE public.order_item_additions ADD CONSTRAINT fk_order_item_additions_order_item_tenant
    FOREIGN KEY (order_item_id, restaurant_id)
    REFERENCES public.order_items(id, restaurant_id)
    ON DELETE CASCADE;

ALTER TABLE public.products ADD CONSTRAINT fk_products_category_tenant
    FOREIGN KEY (category_id, restaurant_id)
    REFERENCES public.categories(id, restaurant_id)
    -- PG15+ column list: anula SOLO category_id al borrar la categoría
    -- (comportamiento previo); un SET NULL sin lista anularía también
    -- restaurant_id y fallaría por NOT NULL con productos existentes.
    ON DELETE SET NULL (category_id);

-- ── 4. Trigger: métricas de customer tenant-scoped (M2/M3) ──────────────────
-- El agregado se filtra por el restaurant_id de la orden disparadora (fuente
-- OLD/NEW según operación), y el UPDATE del customer también (mismo tenant),
-- de modo que las ventas de un tenant jamás recomputan ni escriben los
-- totales de un customer de otro tenant, aunque existiera un link
-- cross-tenant previo al fix de FKs. CREATE OR REPLACE preserva privilegios.
CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
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
    -- disparadora (fuente OLD/NEW según operación, igual que v_customer_id)
    -- para que las ventas de un tenant jamás recomputen los totales de un
    -- customer de otro tenant, aunque hubiera entrado un link cross-tenant
    -- antes del fix de FKs compuestos.
    IF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
        v_restaurant_id := OLD.restaurant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
        v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
    ELSE
        v_customer_id := NEW.customer_id;
        v_restaurant_id := NEW.restaurant_id;
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

    RETURN NEW;
END;
$$;