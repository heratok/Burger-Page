-- ============================================================================
-- 0000000000008_db_hardening.up.sql
-- Database hardening from the schema audit (mirrors database/01_schema.sql):
--   T2  update_customer_order_metrics locks the customer row before aggregating.
--   T3  STABLE RLS helper functions (app_current_restaurant_id, app_is_super_admin)
--       and every tenant policy rewritten to use them.
--   T4  Public reads scoped to the declared restaurant slug (app.restaurant_slug);
--       no public read on products/additions.
--   T5  order_status_history is append-only for app_user (+ BEFORE UPDATE guard).
--   T6  Restaurant FKs of orders/order_items/order_item_additions/
--       order_status_history become ON DELETE RESTRICT.
--   T7  restaurant_hours dropped; opening_hours_text dropped after a safe backfill
--       (aborts when it would lose information).
--   T8  Optional text: '' becomes NULL and the '' defaults are dropped.
--   T9  CHECK orders.final_total = subtotal + delivery_fee.
--   T10 CHECK id format ^[A-Za-z0-9_-]{1,64}$ on every table's id primary key.
--
-- (T1, the app_user password reset, and T12, stale comments, only touch the
-- baseline file: no database change is needed.)
--
-- Every "-- ── T<n>." section marker below is relied on by the integration
-- tests that run a single section against a scratch database.
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

-- ── T4. Slug-scoped public reads ─────────────────────────────────────────────
-- Slug the storefront declares (PgClient.withTenantContext restaurantSlug) for
-- the one anonymous lookup that has no tenant yet: resolving a restaurant by its
-- public slug. Only the public read policies below look at it.
CREATE OR REPLACE FUNCTION public.app_current_restaurant_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT NULLIF(current_setting('app.restaurant_slug', true), '');
$$;

GRANT EXECUTE ON FUNCTION public.app_current_restaurant_slug() TO app_user;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_current_restaurant_slug() TO service_role';
    END IF;
END;
$$;

DROP POLICY IF EXISTS "public_read_available_products" ON public.products;
DROP POLICY IF EXISTS "public_read_available_additions" ON public.product_additions;

DROP POLICY IF EXISTS "public_read_active_restaurants" ON public.restaurants;
CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    USING (
        is_active = TRUE
        AND (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND slug = (SELECT public.app_current_restaurant_slug())
    );

DROP POLICY IF EXISTS "public_read_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "public_read_restaurant_settings"
    ON public.restaurant_settings FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_settings.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "public_read_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "public_read_restaurant_branding"
    ON public.restaurant_branding FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_branding.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    USING (
        is_active = TRUE
        AND (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

-- ── T5. order_status_history is append-only for app_user ────────────────────
REVOKE UPDATE, DELETE ON public.order_status_history FROM app_user;

CREATE OR REPLACE FUNCTION public.guard_order_status_history_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'order_status_history is append-only: rows cannot be updated'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_history_immutable ON public.order_status_history;
CREATE TRIGGER trg_order_status_history_immutable
    BEFORE UPDATE ON public.order_status_history
    FOR EACH ROW EXECUTE FUNCTION public.guard_order_status_history_immutable();

COMMENT ON TABLE public.order_status_history IS 'Auditoría append-only de transiciones de estado: solo la inserta el trigger de orders; app_user no puede actualizar ni borrar (el borrado de una orden la elimina en cascada).';

-- ── T6. Sales and audit history survive a restaurant delete (RESTRICT) ──────
-- Existing rows already satisfy the old FKs, so the new ones are added NOT
-- VALID and validated (SHARE UPDATE EXCLUSIVE only). Skipped when already RESTRICT.
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
              AND confdeltype = 'r'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_restaurant_id_fkey');
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE RESTRICT NOT VALID',
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

-- ── T7. Hours: open_time/close_time become the single source ────────────────
-- 7a. restaurant_hours (per-weekday detail) is not used by the application. It
--     is dropped only when empty: rows would be silent data loss, so the
--     migration aborts instead and the operator decides what to do with them.
DO $$
DECLARE
    v_rows BIGINT;
BEGIN
    IF to_regclass('public.restaurant_hours') IS NOT NULL THEN
        EXECUTE 'SELECT COUNT(*) FROM public.restaurant_hours' INTO v_rows;
        IF v_rows > 0 THEN
            RAISE EXCEPTION
                'Cannot drop public.restaurant_hours: it still holds % row(s). Nothing was changed. Export or delete them, then re-run the migration.',
                v_rows
                USING ERRCODE = '23000';
        END IF;
    END IF;
END
$$;

DROP TABLE IF EXISTS public.restaurant_hours;

-- 7b. opening_hours_text -> open_time/close_time. Where a time is NULL and the
--     text is a valid "HH:MM - HH:MM" range, the times are backfilled from it.
--     Afterwards every non-NULL text must say the same as the times (formatting
--     differences such as "9:00 -  22:30" are fine); anything else (free-form
--     text, or a range that contradicts the times) would be lost with the
--     column, so the migration aborts with the offending restaurant ids.
DO $$
DECLARE
    v_mismatch BIGINT;
    v_ids      TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'restaurant_settings'
          AND column_name = 'opening_hours_text'
    ) THEN
        UPDATE public.restaurant_settings s
        SET open_time  = COALESCE(s.open_time,  p.parts[1]::time),
            close_time = COALESCE(s.close_time, p.parts[2]::time)
        FROM (
            SELECT rs.restaurant_id, m.parts
            FROM public.restaurant_settings rs
            CROSS JOIN LATERAL regexp_match(
                rs.opening_hours_text,
                '^\s*((?:[01]?\d|2[0-3]):[0-5]\d)\s*-\s*((?:[01]?\d|2[0-3]):[0-5]\d)\s*$'
            ) AS m(parts)
            WHERE rs.opening_hours_text IS NOT NULL
              AND (rs.open_time IS NULL OR rs.close_time IS NULL)
        ) p
        WHERE s.restaurant_id = p.restaurant_id
          AND p.parts IS NOT NULL;

        SELECT COUNT(*), string_agg(restaurant_id, ', ' ORDER BY restaurant_id)
        INTO v_mismatch, v_ids
        FROM (
            SELECT rs.restaurant_id
            FROM public.restaurant_settings rs
            LEFT JOIN LATERAL regexp_match(
                rs.opening_hours_text,
                '^\s*((?:[01]?\d|2[0-3]):[0-5]\d)\s*-\s*((?:[01]?\d|2[0-3]):[0-5]\d)\s*$'
            ) AS m(parts) ON TRUE
            WHERE rs.opening_hours_text IS NOT NULL
              AND NOT (
                  rs.open_time IS NOT NULL
                  AND rs.close_time IS NOT NULL
                  AND m.parts IS NOT NULL
                  AND lpad(m.parts[1], 5, '0') = to_char(rs.open_time, 'HH24:MI')
                  AND lpad(m.parts[2], 5, '0') = to_char(rs.close_time, 'HH24:MI')
              )
            LIMIT 20
        ) bad;

        IF v_mismatch > 0 THEN
            RAISE EXCEPTION
                'Cannot drop restaurant_settings.opening_hours_text: restaurant_id(s) % have an opening_hours_text that differs from open_time/close_time and would be lost. Nothing was changed. Align the text with the times (or clear it) and re-run the migration.',
                v_ids
                USING ERRCODE = '23000';
        END IF;
    END IF;
END
$$;

ALTER TABLE public.restaurant_settings DROP COLUMN IF EXISTS opening_hours_text;

COMMENT ON COLUMN public.restaurant_settings.open_time IS 'Hora de apertura del restaurante (fuente única del horario junto con close_time).';

-- ── T8. Optional text: '' becomes NULL, '' defaults dropped ───────────────────
UPDATE public.customers SET email = NULLIF(email, '') WHERE email = '';
UPDATE public.customers SET address = NULLIF(address, '') WHERE address = '';
UPDATE public.customers SET barrio = NULLIF(barrio, '') WHERE barrio = '';
UPDATE public.products SET description = NULLIF(description, '') WHERE description = '';
UPDATE public.suppliers SET contact_name = NULLIF(contact_name, '') WHERE contact_name = '';
UPDATE public.suppliers SET phone = NULLIF(phone, '') WHERE phone = '';
UPDATE public.suppliers SET email = NULLIF(email, '') WHERE email = '';

ALTER TABLE public.customers
    ALTER COLUMN email DROP DEFAULT,
    ALTER COLUMN address DROP DEFAULT,
    ALTER COLUMN barrio DROP DEFAULT;
ALTER TABLE public.products
    ALTER COLUMN description DROP DEFAULT;
ALTER TABLE public.suppliers
    ALTER COLUMN contact_name DROP DEFAULT,
    ALTER COLUMN phone DROP DEFAULT,
    ALTER COLUMN email DROP DEFAULT;

-- ── T9. orders: final_total = subtotal + delivery_fee ────────────────────────
-- Added NOT VALID, then validated. Existing rows that break the invariant make
-- the migration abort with their count instead of being rewritten silently:
--   SELECT id, subtotal, delivery_fee, final_total FROM public.orders
--    WHERE final_total <> subtotal + delivery_fee;
DO $$
DECLARE
    v_bad BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_orders_final_total'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        SELECT COUNT(*) INTO v_bad
        FROM public.orders
        WHERE final_total <> subtotal + delivery_fee;

        IF v_bad > 0 THEN
            RAISE EXCEPTION
                'Cannot add chk_orders_final_total: % order(s) have final_total <> subtotal + delivery_fee. Nothing was changed. Inspect them with the query in the header of this section (0000000000008_db_hardening.up.sql), fix the rows and re-run.',
                v_bad
                USING ERRCODE = '23514';
        END IF;

        ALTER TABLE public.orders
            ADD CONSTRAINT chk_orders_final_total
            CHECK (final_total = subtotal + delivery_fee)
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.orders VALIDATE CONSTRAINT chk_orders_final_total;

-- ── T10. Primary key id format: ^[A-Za-z0-9_-]{1,64}$ ───────────────────────
-- ids are TEXT everywhere; this keeps them short, URL-safe and free of
-- whitespace/control characters. Existing rows are checked first: the migration
-- aborts naming the table and a sample of offending ids instead of rewriting
-- keys that other rows (and clients) reference. Constraints are added NOT VALID
-- and validated afterwards.
DO $$
DECLARE
    t        TEXT;
    v_bad    BIGINT;
    v_sample TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['restaurants', 'users', 'categories', 'products', 'product_additions', 'customers', 'orders', 'order_status_history', 'order_items', 'order_item_additions', 'suppliers', 'inventory_items']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = format('chk_%s_id_format', t)
              AND conrelid = format('public.%I', t)::regclass
        ) THEN
            EXECUTE format(
                'SELECT COUNT(*), string_agg(quote_literal(id), '', '' ORDER BY id) FROM (SELECT id FROM public.%I WHERE id !~ ''^[A-Za-z0-9_-]{1,64}$'' ORDER BY id LIMIT 5) s',
                t
            ) INTO v_bad, v_sample;
            IF v_bad > 0 THEN
                RAISE EXCEPTION
                    'Cannot add chk_%_id_format: public.% has ids that do not match ^[A-Za-z0-9_-]{1,64}$ (sample: %). Nothing was changed. Fix or re-key those rows and re-run the migration.',
                    t, t, v_sample
                    USING ERRCODE = '23514';
            END IF;

            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (id ~ ''^[A-Za-z0-9_-]{1,64}$'') NOT VALID',
                t, format('chk_%s_id_format', t)
            );
        END IF;
    END LOOP;
END
$$;

ALTER TABLE public.restaurants VALIDATE CONSTRAINT chk_restaurants_id_format;
ALTER TABLE public.users VALIDATE CONSTRAINT chk_users_id_format;
ALTER TABLE public.categories VALIDATE CONSTRAINT chk_categories_id_format;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_id_format;
ALTER TABLE public.product_additions VALIDATE CONSTRAINT chk_product_additions_id_format;
ALTER TABLE public.customers VALIDATE CONSTRAINT chk_customers_id_format;
ALTER TABLE public.orders VALIDATE CONSTRAINT chk_orders_id_format;
ALTER TABLE public.order_status_history VALIDATE CONSTRAINT chk_order_status_history_id_format;
ALTER TABLE public.order_items VALIDATE CONSTRAINT chk_order_items_id_format;
ALTER TABLE public.order_item_additions VALIDATE CONSTRAINT chk_order_item_additions_id_format;
ALTER TABLE public.suppliers VALIDATE CONSTRAINT chk_suppliers_id_format;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT chk_inventory_items_id_format;
