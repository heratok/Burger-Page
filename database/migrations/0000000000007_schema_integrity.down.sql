-- ============================================================================
-- 0000000000007_schema_integrity.down.sql
-- Reverses 0000000000007_schema_integrity.up.sql:
--   * restores the four redundant indexes,
--   * restores the original single-column FKs and drops the tenant-scoped ones
--     and the uq_product_additions_id_restaurant target.
--
-- Deliberately NOT reversed: the stale 9-arg create_order_atomic overload. It
-- was SECURITY DEFINER without the tenant guard of the 10-arg function (and
-- could be executable by PUBLIC); recreating a known-insecure function on
-- rollback would reopen a cross-tenant hole, so reversing means "keep it dropped".
--
-- Idempotent; safe on live data (the old single-column FKs are weaker than the
-- composite ones, so existing rows always satisfy them).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── 1. Redundant indexes (same definitions as the former baseline) ──────────
CREATE INDEX IF NOT EXISTS idx_users_username            ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_customers_rest_phone      ON public.customers(restaurant_id, phone);
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_rest     ON public.restaurant_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant ON public.inventory_items(restaurant_id);

-- ── 2. Single-column FKs back, tenant-scoped FKs out ────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'order_items_product_id_fkey'
          AND conrelid = 'public.order_items'::regclass
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT order_items_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'order_item_additions_addition_id_fkey'
          AND conrelid = 'public.order_item_additions'::regclass
    ) THEN
        ALTER TABLE public.order_item_additions
            ADD CONSTRAINT order_item_additions_addition_id_fkey
            FOREIGN KEY (addition_id) REFERENCES public.product_additions(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS fk_order_items_product_tenant;
ALTER TABLE public.order_item_additions
    DROP CONSTRAINT IF EXISTS fk_order_item_additions_addition_tenant;

-- The composite FK above was the only dependent of this constraint.
ALTER TABLE public.product_additions
    DROP CONSTRAINT IF EXISTS uq_product_additions_id_restaurant;
