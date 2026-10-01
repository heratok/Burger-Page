-- ============================================================================
-- 0000000000008_db_hardening.down.sql
-- Reverses 0000000000008_db_hardening.up.sql, restoring the 0000000000007 state.
-- Sections run in the reverse order of the up file. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T8. '' defaults back, NULL becomes '' again ─────────────────────────────
ALTER TABLE public.customers
    ALTER COLUMN email SET DEFAULT '',
    ALTER COLUMN address SET DEFAULT '',
    ALTER COLUMN barrio SET DEFAULT '';
ALTER TABLE public.products
    ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.suppliers
    ALTER COLUMN contact_name SET DEFAULT '',
    ALTER COLUMN phone SET DEFAULT '',
    ALTER COLUMN email SET DEFAULT '';

UPDATE public.customers SET email = COALESCE(email, '') WHERE email IS NULL;
UPDATE public.customers SET address = COALESCE(address, '') WHERE address IS NULL;
UPDATE public.customers SET barrio = COALESCE(barrio, '') WHERE barrio IS NULL;
UPDATE public.products SET description = COALESCE(description, '') WHERE description IS NULL;
UPDATE public.suppliers SET contact_name = COALESCE(contact_name, '') WHERE contact_name IS NULL;
UPDATE public.suppliers SET phone = COALESCE(phone, '') WHERE phone IS NULL;
UPDATE public.suppliers SET email = COALESCE(email, '') WHERE email IS NULL;

-- ── T7. restaurant_hours and opening_hours_text back ────────────────────────
-- The text is rebuilt from the times (the only data that survived); rows whose
-- times are NULL keep a NULL text, then the 0007 default is restored.
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS opening_hours_text TEXT;

UPDATE public.restaurant_settings
SET opening_hours_text = to_char(open_time, 'HH24:MI') || ' - ' || to_char(close_time, 'HH24:MI')
WHERE opening_hours_text IS NULL
  AND open_time IS NOT NULL
  AND close_time IS NOT NULL;

ALTER TABLE public.restaurant_settings ALTER COLUMN opening_hours_text SET DEFAULT '12:00 - 22:30';

CREATE TABLE IF NOT EXISTS public.restaurant_hours (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id  TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    open_time      TIME,
    close_time     TIME,
    is_closed      BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_restaurant_hours_day
        UNIQUE (restaurant_id, day_of_week),
    CONSTRAINT chk_hours_consistent
        CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

COMMENT ON TABLE public.restaurant_hours IS 'Horarios por día de la semana (0=Domingo..6=Sábado).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_hours TO app_user;
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_hours FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_restaurant_hours" ON public.restaurant_hours;
CREATE POLICY "public_read_restaurant_hours"
    ON public.restaurant_hours FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

-- ── T6. Restaurant FKs back to ON DELETE CASCADE ────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['orders', 'order_items', 'order_item_additions', 'order_status_history']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = t || '_restaurant_id_fkey'
              AND conrelid = format('public.%I', t)::regclass
              AND confdeltype = 'c'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_restaurant_id_fkey');
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE NOT VALID',
                t, t || '_restaurant_id_fkey'
            );
        END IF;
    END LOOP;
END
$$;

ALTER TABLE public.orders VALIDATE CONSTRAINT orders_restaurant_id_fkey;
ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_restaurant_id_fkey;
ALTER TABLE public.order_item_additions VALIDATE CONSTRAINT order_item_additions_restaurant_id_fkey;
ALTER TABLE public.order_status_history VALIDATE CONSTRAINT order_status_history_restaurant_id_fkey;

-- ── T5. order_status_history writable again ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_order_status_history_immutable ON public.order_status_history;
DROP FUNCTION IF EXISTS public.guard_order_status_history_immutable();
GRANT UPDATE, DELETE ON public.order_status_history TO app_user;

-- ── T4. Blanket public reads back ────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_active_restaurants" ON public.restaurants;
CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "public_read_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "public_read_restaurant_settings"
    ON public.restaurant_settings FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "public_read_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "public_read_restaurant_branding"
    ON public.restaurant_branding FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "public_read_available_products" ON public.products;
CREATE POLICY "public_read_available_products"
    ON public.products FOR SELECT
    USING (is_available = TRUE);

DROP POLICY IF EXISTS "public_read_available_additions" ON public.product_additions;
CREATE POLICY "public_read_available_additions"
    ON public.product_additions FOR SELECT
    USING (is_available = TRUE);

DROP FUNCTION IF EXISTS public.app_current_restaurant_slug();

-- ── T3. Inline current_setting policies back, helpers out ───────────────────

DROP POLICY IF EXISTS "users_select_for_auth" ON public.users;
CREATE POLICY "users_select_for_auth" ON public.users
    FOR SELECT
    USING (
        ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
        OR (
            (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), '')) IS NOT NULL
            AND restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_users_write" ON public.users;
CREATE POLICY "tenant_isolation_users_write" ON public.users
    FOR INSERT
    WITH CHECK (
        ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
        OR (
            restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
            AND role <> 'super_admin'::text
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_users_update" ON public.users;
-- Fail-closed updates: USING (TRUE) reveals rows so that disallowed
-- writes raise 42501 via WITH CHECK instead of silently updating 0
-- rows. A tenant session can never touch platform rows
-- (restaurant_id IS NULL) or other tenants' rows, and can never mint
-- or escalate a row to super_admin; the BEFORE UPDATE trigger below
-- remains the backstop for role/restaurant changes.
CREATE POLICY "tenant_isolation_users_update" ON public.users
    FOR UPDATE
    USING (TRUE)
    WITH CHECK (
        ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
        OR (
            restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
            AND role <> 'super_admin'::text
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_users_delete" ON public.users;
CREATE POLICY "tenant_isolation_users_delete" ON public.users
    FOR DELETE
    USING (
        ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
        OR (restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), '')))
    );

DROP POLICY IF EXISTS "tenant_isolation_restaurants_write" ON public.restaurants;
CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING ((id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "tenant_isolation_restaurant_settings" ON public.restaurant_settings
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "tenant_isolation_restaurant_branding" ON public.restaurant_branding
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_select" ON public.categories;
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_write" ON public.categories;
CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_update" ON public.categories;
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_delete" ON public.categories;
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_select" ON public.products;
CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_write" ON public.products;
CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_update" ON public.products;
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_delete" ON public.products;
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_select" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_write" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_update" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_delete" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_customers" ON public.customers;
CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_orders" ON public.orders;
CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_items" ON public.order_items;
CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_item_additions" ON public.order_item_additions;
CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_status_history" ON public.order_status_history;
CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters;
CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_inventory_items" ON public.inventory_items;
CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP FUNCTION IF EXISTS public.app_is_super_admin();
DROP FUNCTION IF EXISTS public.app_current_restaurant_id();

-- ── T2. Back to the 0000000000006 body (no row lock) ────────────────────────
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

    FOR v_customer_id IN
        SELECT DISTINCT c FROM unnest(v_customer_ids) AS c WHERE c IS NOT NULL
    LOOP
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
