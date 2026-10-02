-- ============================================================================
-- 0000000000010_restaurant_tables.up.sql
-- Tables per restaurant (mirrors database/01_schema.sql):
--   T1  restaurant_tables: the dine-in tables an owner manages (name, order,
--       active flag). Names are unique per restaurant, case-insensitive.
--   T2  orders.table_id / orders.table_label: the table a "Mesa / Salon" sale
--       was taken on. table_id is a tenant-scoped FK (SET NULL when the table
--       is deleted); table_label is a snapshot so history keeps the name.
--
-- Every "-- ── T<n>." section marker below is relied on by the integration
-- tests that run a single section against a scratch database.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
--
-- Requires PostgreSQL 15+ (ON DELETE SET NULL column list).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T1. restaurant_tables ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_restaurant_tables_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_restaurant_tables_name
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    CONSTRAINT uq_restaurant_tables_id_restaurant
        UNIQUE (id, restaurant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_tables_name
    ON public.restaurant_tables (restaurant_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_order
    ON public.restaurant_tables (restaurant_id, sort_order);

COMMENT ON TABLE public.restaurant_tables IS 'Mesas del salón de un restaurante. Configuración: se borra en cascada con el restaurante; borrar una mesa no borra pedidos (orders.table_id pasa a NULL y table_label conserva el nombre).';
COMMENT ON COLUMN public.restaurant_tables.name IS 'Nombre visible (p. ej. "Mesa 4", "Terraza 2"); único por restaurante sin distinguir mayúsculas.';
COMMENT ON COLUMN public.restaurant_tables.sort_order IS 'Posición en la lista y en el selector de venta (menor primero).';
COMMENT ON COLUMN public.restaurant_tables.is_active IS 'false oculta la mesa del selector de venta sin borrar su historial.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO app_user;

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "tenant_isolation_restaurant_tables" ON public.restaurant_tables
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON public.restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
    BEFORE UPDATE ON public.restaurant_tables
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── T2. orders.table_id / orders.table_label ────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS table_id TEXT,
    ADD COLUMN IF NOT EXISTS table_label TEXT;

-- The table must belong to the same restaurant as the order. SET NULL with a
-- column list clears ONLY table_id (restaurant_id is NOT NULL), keeping
-- table_label as the historical name.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_orders_table_tenant'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT fk_orders_table_tenant
            FOREIGN KEY (table_id, restaurant_id)
            REFERENCES public.restaurant_tables(id, restaurant_id)
            ON DELETE SET NULL (table_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders (table_id) WHERE table_id IS NOT NULL;

COMMENT ON COLUMN public.orders.table_id IS 'Mesa donde se tomó la venta de salón (NULL si no aplica o si la mesa se borró).';
COMMENT ON COLUMN public.orders.table_label IS 'Snapshot del nombre de la mesa al vender: el historial lo conserva aunque la mesa se renombre o se borre.';
