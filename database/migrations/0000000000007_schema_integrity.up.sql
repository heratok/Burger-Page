-- ============================================================================
-- 0000000000007_schema_integrity.up.sql
-- Schema integrity fixes (mirrors database/01_schema.sql):
--   1. Drop the stale 9-arg create_order_atomic overload (SECURITY DEFINER, no
--      tenant guard) that databases built only through migrations may still
--      carry. 0000000000002 dropped only the 8-arg overload.
--   2. Tenant-scoped FKs for order_items.product_id and
--      order_item_additions.addition_id, so a sale line can no longer point at
--      another restaurant's product/addition.
--   3. Drop indexes that duplicate another index on the same table.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
--
-- FAILS LOUDLY (by design) when cross-tenant references already exist:
-- step 2 raises an exception with the offending row counts instead of
-- silently nulling or deleting sales data. To inspect before migrating:
--
--   SELECT oi.id, oi.restaurant_id AS item_restaurant, p.restaurant_id AS product_restaurant
--     FROM public.order_items oi
--     JOIN public.products p ON p.id = oi.product_id
--    WHERE p.restaurant_id <> oi.restaurant_id;
--
--   SELECT oia.id, oia.restaurant_id AS line_restaurant, pa.restaurant_id AS addition_restaurant
--     FROM public.order_item_additions oia
--     JOIN public.product_additions pa ON pa.id = oia.addition_id
--    WHERE pa.restaurant_id <> oia.restaurant_id;
--
-- Fix those rows by hand (e.g. UPDATE ... SET product_id = NULL: the line keeps
-- its product_name/unit_price snapshot) and re-run the migration.
--
-- Requires PostgreSQL 15+ (ON DELETE SET NULL (column_list)).
-- ============================================================================

-- Fail fast instead of queueing behind long-running transactions while this
-- migration holds (or waits for) table locks. Scoped to this transaction.
SET LOCAL lock_timeout = '15s';

-- ── 1. Stale 9-arg create_order_atomic overload ─────────────────────────────
-- The hardened signature is the 10-arg one (p_client_order_id). DROP
-- removes the stale overload together with any grants it carried.
DROP FUNCTION IF EXISTS public.create_order_atomic(
    TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC
);

-- ── 2. Composite tenant FKs ─────────────────────────────────────────────────
-- 2a. UNIQUE (id, restaurant_id) target on product_additions (products already
--     has uq_products_id_restaurant). id is the primary key, so this cannot
--     fail on existing data.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_product_additions_id_restaurant'
          AND conrelid = 'public.product_additions'::regclass
    ) THEN
        ALTER TABLE public.product_additions
            ADD CONSTRAINT uq_product_additions_id_restaurant UNIQUE (id, restaurant_id);
    END IF;
END
$$;

-- 2b. Pre-check: refuse to continue when cross-tenant references exist.
DO $$
DECLARE
    v_items     BIGINT;
    v_additions BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_items
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE p.restaurant_id <> oi.restaurant_id;

    SELECT COUNT(*) INTO v_additions
    FROM public.order_item_additions oia
    JOIN public.product_additions pa ON pa.id = oia.addition_id
    WHERE pa.restaurant_id <> oia.restaurant_id;

    IF v_items > 0 OR v_additions > 0 THEN
        RAISE EXCEPTION
            'Cross-tenant references block 0000000000007: % order_items row(s) point at another restaurant''s product and % order_item_additions row(s) point at another restaurant''s addition. Nothing was changed. Inspect them with the queries in the header of 0000000000007_schema_integrity.up.sql, fix the rows and re-run.',
            v_items, v_additions
            USING ERRCODE = '23503';
    END IF;
END
$$;

-- 2c. Add the composite FKs NOT VALID, then VALIDATE (validation only needs a
--     SHARE UPDATE EXCLUSIVE lock). Skipped when they already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_order_items_product_tenant'
          AND conrelid = 'public.order_items'::regclass
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT fk_order_items_product_tenant
            FOREIGN KEY (product_id, restaurant_id)
            REFERENCES public.products(id, restaurant_id)
            -- PG15+ column list: nulls only product_id (previous behaviour);
            -- a bare SET NULL would also null the NOT NULL restaurant_id.
            ON DELETE SET NULL (product_id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_order_item_additions_addition_tenant'
          AND conrelid = 'public.order_item_additions'::regclass
    ) THEN
        ALTER TABLE public.order_item_additions
            ADD CONSTRAINT fk_order_item_additions_addition_tenant
            FOREIGN KEY (addition_id, restaurant_id)
            REFERENCES public.product_additions(id, restaurant_id)
            ON DELETE SET NULL (addition_id)
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.order_items
    VALIDATE CONSTRAINT fk_order_items_product_tenant;
ALTER TABLE public.order_item_additions
    VALIDATE CONSTRAINT fk_order_item_additions_addition_tenant;

-- 2d. The original single-column FKs (auto-generated names) are now redundant.
ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.order_item_additions
    DROP CONSTRAINT IF EXISTS order_item_additions_addition_id_fkey;

-- ── 3. Redundant indexes ────────────────────────────────────────────────────
-- Each one is covered by an index that starts with the same column(s):
--   idx_users_username             (username)                = users_username_key
--   idx_customers_rest_phone       (restaurant_id, phone)    = uq_customers_restaurant_phone
--   idx_restaurant_hours_rest      (restaurant_id)           = prefix of uq_restaurant_hours_day
--   idx_inventory_items_restaurant (restaurant_id)           = prefix of idx_inventory_items_low_stock
-- A duplicate is dropped only when its covering index exists, so a drifted
-- database never ends up with no index at all.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('idx_users_username',             'users_username_key'),
            ('idx_customers_rest_phone',       'uq_customers_restaurant_phone'),
            ('idx_restaurant_hours_rest',      'uq_restaurant_hours_day'),
            ('idx_inventory_items_restaurant', 'idx_inventory_items_low_stock')
        ) AS t(duplicate_index, covering_index)
    LOOP
        IF to_regclass(format('public.%I', r.covering_index)) IS NOT NULL THEN
            EXECUTE format('DROP INDEX IF EXISTS public.%I', r.duplicate_index);
        ELSE
            RAISE NOTICE 'Keeping % : covering index % not found', r.duplicate_index, r.covering_index;
        END IF;
    END LOOP;
END
$$;
