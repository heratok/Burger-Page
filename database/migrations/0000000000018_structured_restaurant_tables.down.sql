-- ============================================================================
-- 0000000000018_structured_restaurant_tables.down.sql
-- Restores the 0010 state. name already holds the derived text, so it is kept
-- (cut to the old 40 character limit); zone/number/alias are dropped, which
-- loses the separation but no visible text. Recreating the old unique index
-- fails loudly if two names collide after being cut.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T3. structured constraints and index removed ────────────────────────────
DROP INDEX IF EXISTS public.uq_restaurant_tables_zone_number;
ALTER TABLE public.restaurant_tables
    DROP CONSTRAINT IF EXISTS chk_restaurant_tables_zone,
    DROP CONSTRAINT IF EXISTS chk_restaurant_tables_number,
    DROP CONSTRAINT IF EXISTS chk_restaurant_tables_alias;

-- ── T2. name limit and unique index on name restored ────────────────────────
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS chk_restaurant_tables_name;
UPDATE public.restaurant_tables SET name = btrim(left(name, 40)) WHERE char_length(name) > 40;
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT chk_restaurant_tables_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 40);

CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_tables_name
    ON public.restaurant_tables (restaurant_id, lower(btrim(name)));

COMMENT ON COLUMN public.restaurant_tables.name IS 'Nombre visible (p. ej. "Mesa 4", "Terraza 2"); único por restaurante sin distinguir mayúsculas.';

-- ── T1. zone / number / alias columns removed ───────────────────────────────
ALTER TABLE public.restaurant_tables
    DROP COLUMN IF EXISTS zone,
    DROP COLUMN IF EXISTS number,
    DROP COLUMN IF EXISTS alias;
