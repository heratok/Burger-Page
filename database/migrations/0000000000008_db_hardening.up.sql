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

-- ── T3. RLS helper functions and tenant policies ────────────────────────────
CREATE OR REPLACE FUNCTION public.app_current_restaurant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT NULLIF(current_setting('app.restaurant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.actor_role', true), '') = 'super_admin', FALSE);
$$;

-- RLS helpers: read-only GUC lookups, no data access. PUBLIC keeps its default
-- EXECUTE on purpose: a session of another role (e.g. Supabase anon) must get an
-- empty result from the policies, not a permission error. The explicit grants
-- document the roles that rely on them.
GRANT EXECUTE ON FUNCTION public.app_current_restaurant_id() TO app_user;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO app_user;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_current_restaurant_id() TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO service_role';
    END IF;
END;
$$;


-- Same semantics as before: tenant match OR platform super_admin. Policy names
-- are unchanged. The public read policies are handled in T4.

DROP POLICY IF EXISTS "users_select_for_auth" ON public.users;
CREATE POLICY "users_select_for_auth" ON public.users
    FOR SELECT
    USING (
        (SELECT public.app_is_super_admin())
        OR (
            (SELECT public.app_current_restaurant_id()) IS NOT NULL
            AND restaurant_id = (SELECT public.app_current_restaurant_id())
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_users_write" ON public.users;
CREATE POLICY "tenant_isolation_users_write" ON public.users
    FOR INSERT
    WITH CHECK (
        (SELECT public.app_is_super_admin())
        OR (
            restaurant_id = (SELECT public.app_current_restaurant_id())
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
        (SELECT public.app_is_super_admin())
        OR (
            restaurant_id = (SELECT public.app_current_restaurant_id())
            AND role <> 'super_admin'::text
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_users_delete" ON public.users;
CREATE POLICY "tenant_isolation_users_delete" ON public.users
    FOR DELETE
    USING (
        (SELECT public.app_is_super_admin())
        OR (restaurant_id = (SELECT public.app_current_restaurant_id()))
    );

DROP POLICY IF EXISTS "tenant_isolation_restaurants_write" ON public.restaurants;
CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING ((id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "tenant_isolation_restaurant_settings" ON public.restaurant_settings
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "tenant_isolation_restaurant_branding" ON public.restaurant_branding
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_select" ON public.categories;
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_write" ON public.categories;
CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_update" ON public.categories;
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_delete" ON public.categories;
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_select" ON public.products;
CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_write" ON public.products;
CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_update" ON public.products;
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_delete" ON public.products;
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_select" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_write" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_update" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_delete" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_customers" ON public.customers;
CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_orders" ON public.orders;
CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_order_items" ON public.order_items;
CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_order_item_additions" ON public.order_item_additions;
CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_order_status_history" ON public.order_status_history;
CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters;
CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_inventory_items" ON public.inventory_items;
CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));
