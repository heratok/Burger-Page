-- ============================================================================
-- Migration 001 — feature/security-hardening
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Rename inventory → inventory_items
--    The old table was ambiguous. All code now references inventory_items.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_items'
    ) THEN
        ALTER TABLE public.inventory RENAME TO inventory_items;
        RAISE NOTICE 'Renamed inventory → inventory_items';
    ELSE
        RAISE NOTICE 'Skipping rename: inventory_items already exists or inventory does not exist';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Add UNIQUE(id, restaurant_id) constraints needed for safe upserts
--    (onConflict: 'id,restaurant_id' in Supabase requires a real constraint)
-- ----------------------------------------------------------------------------

-- 2a. customers
DO $$
BEGIN
    ALTER TABLE public.customers
        ADD CONSTRAINT uq_customers_id_restaurant
        UNIQUE (id, restaurant_id);
    RAISE NOTICE 'Added uq_customers_id_restaurant';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint uq_customers_id_restaurant already exists, skipping';
END $$;

-- 2b. inventory_items
DO $$
BEGIN
    ALTER TABLE public.inventory_items
        ADD CONSTRAINT uq_inventory_items_id_restaurant
        UNIQUE (id, restaurant_id);
    RAISE NOTICE 'Added uq_inventory_items_id_restaurant';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint uq_inventory_items_id_restaurant already exists, skipping';
END $$;

-- 2c. suppliers (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'suppliers'
    ) THEN
        BEGIN
            ALTER TABLE public.suppliers
                ADD CONSTRAINT uq_suppliers_id_restaurant
                UNIQUE (id, restaurant_id);
            RAISE NOTICE 'Added uq_suppliers_id_restaurant';
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE 'Constraint uq_suppliers_id_restaurant already exists, skipping';
        END;
    ELSE
        RAISE NOTICE 'Table suppliers does not exist, skipping';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. Soft delete support for restaurants
--    is_active already exists in most schemas, but ensure the column is there.
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;


-- ----------------------------------------------------------------------------
-- 4. Create adjust_inventory_stock — concurrency-safe atomic stock adjustment
--    Uses IF/ELSE to apply the stock guard ONLY on decrements (delta < 0).
--    Restocking (delta >= 0) is never blocked by the current_stock check.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
    p_id TEXT,
    p_restaurant_id TEXT,
    p_delta NUMERIC
)
RETURNS SETOF public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_delta < 0 THEN
        -- Decrement: only proceed if there is enough stock
        RETURN QUERY
        UPDATE public.inventory_items
        SET current_stock = current_stock + p_delta,
            updated_at    = NOW()
        WHERE id            = p_id
          AND restaurant_id = p_restaurant_id
          AND current_stock >= ABS(p_delta)
        RETURNING *;
    ELSE
        -- Restock / positive adjustment: no stock guard needed
        RETURN QUERY
        UPDATE public.inventory_items
        SET current_stock = current_stock + p_delta,
            updated_at    = NOW()
        WHERE id            = p_id
          AND restaurant_id = p_restaurant_id
        RETURNING *;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4.1 Security hardening on RPC execution:
--     Revoke PUBLIC / anon access; restrict strictly to service_role and postgres.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO postgres;


-- ----------------------------------------------------------------------------
-- 5. Verify — quick sanity check (results appear in the SQL Editor output)
-- ----------------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'inventory_items')       AS inventory_items_exists,

    (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name   = 'customers'
       AND constraint_name = 'uq_customers_id_restaurant')                   AS customers_constraint_exists,

    (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name   = 'inventory_items'
       AND constraint_name = 'uq_inventory_items_id_restaurant')             AS inventory_constraint_exists,

    (SELECT COUNT(*) FROM information_schema.routines
     WHERE routine_schema = 'public'
       AND routine_name   = 'adjust_inventory_stock')                        AS adjust_stock_fn_exists;
-- Expected output: all four columns = 1
