-- ============================================================================
-- 0000000000018_structured_restaurant_tables.up.sql
-- Structured restaurant tables (mirrors database/01_schema.sql):
--   T1  restaurant_tables.zone / number / alias columns (added nullable).
--   T2  Backfill of every existing row from its free-text name. Never aborts
--       and never loses information: what cannot be parsed keeps the original
--       text as alias.
--   T3  NOT NULL, range checks, widened name check and the new unique index
--       (restaurant_id, lower(btrim(zone)), number) replacing the old one on
--       name.
--
-- name stays a stored column, always derived by the application as
-- "<zone> <number>" or "<zone> <number> · <alias>" (orders.table_label keeps
-- snapshotting it, so history is unchanged).
--
-- Every "-- ── T<n>." section marker below is relied on by the integration
-- tests that run a single section against a scratch database.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent: the
-- backfill only touches rows whose zone is still NULL.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T1. zone / number / alias columns ───────────────────────────────────────
ALTER TABLE public.restaurant_tables
    ADD COLUMN IF NOT EXISTS zone   TEXT,
    ADD COLUMN IF NOT EXISTS number INTEGER,
    ADD COLUMN IF NOT EXISTS alias  TEXT;

-- ── T2. backfill from the free-text name ────────────────────────────────────
-- Pass 1 (in list order): a name ending in digits becomes (zone = text before
-- the digits, number = the digits) when the zone fits 30 characters, the
-- number fits 1..9999 and (restaurant, lower(zone), number) is still free.
-- An empty zone ("12") becomes "Mesa". Pass 2: every remaining row goes to
-- zone "Mesa", the lowest free number, with its original text (cut to 30
-- characters) as alias. Two passes so a name like "VIP" never steals the
-- number a later "Mesa 1" legitimately owns.
DO $$
DECLARE
    r        RECORD;
    v_clean  TEXT;
    v_digits TEXT;
    v_zone   TEXT;
    v_number INTEGER;
BEGIN
    FOR r IN
        SELECT id, restaurant_id, name
        FROM public.restaurant_tables
        WHERE zone IS NULL
        ORDER BY restaurant_id, sort_order, created_at, id
    LOOP
        v_clean  := btrim(regexp_replace(r.name, '\s+', ' ', 'g'));
        v_digits := substring(v_clean FROM '(\d+)$');
        CONTINUE WHEN v_digits IS NULL OR length(ltrim(v_digits, '0')) NOT BETWEEN 1 AND 4;

        v_number := v_digits::INTEGER;
        v_zone   := btrim(regexp_replace(regexp_replace(v_clean, '\d+$', ''), '[\s#.:-]+$', ''));
        IF v_zone = '' THEN
            v_zone := 'Mesa';
        ELSE
            v_zone := upper(left(v_zone, 1)) || substr(v_zone, 2);
        END IF;
        CONTINUE WHEN char_length(v_zone) > 30;

        IF NOT EXISTS (
            SELECT 1 FROM public.restaurant_tables t
            WHERE t.restaurant_id = r.restaurant_id
              AND t.zone IS NOT NULL
              AND lower(btrim(t.zone)) = lower(v_zone)
              AND t.number = v_number
        ) THEN
            UPDATE public.restaurant_tables SET zone = v_zone, number = v_number WHERE id = r.id;
        END IF;
    END LOOP;

    FOR r IN
        SELECT id, restaurant_id, name
        FROM public.restaurant_tables
        WHERE zone IS NULL
        ORDER BY restaurant_id, sort_order, created_at, id
    LOOP
        SELECT g INTO v_number
        FROM generate_series(1, 9999) AS g
        WHERE NOT EXISTS (
            SELECT 1 FROM public.restaurant_tables t
            WHERE t.restaurant_id = r.restaurant_id
              AND t.zone IS NOT NULL
              AND lower(btrim(t.zone)) = 'mesa'
              AND t.number = g
        )
        ORDER BY g
        LIMIT 1;

        IF v_number IS NULL THEN
            RAISE EXCEPTION 'restaurant % has no free Mesa number left (table %)', r.restaurant_id, r.id;
        END IF;

        UPDATE public.restaurant_tables
        SET zone   = 'Mesa',
            number = v_number,
            alias  = left(btrim(regexp_replace(r.name, '\s+', ' ', 'g')), 30)
        WHERE id = r.id;
    END LOOP;

    -- name is derived from the structured columns from now on.
    UPDATE public.restaurant_tables
    SET name = zone || ' ' || number || COALESCE(' · ' || alias, '')
    WHERE name IS DISTINCT FROM zone || ' ' || number || COALESCE(' · ' || alias, '');
END
$$;

-- ── T3. constraints and unique index ────────────────────────────────────────
ALTER TABLE public.restaurant_tables
    ALTER COLUMN zone SET NOT NULL,
    ALTER COLUMN number SET NOT NULL;

ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS chk_restaurant_tables_zone;
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT chk_restaurant_tables_zone
    CHECK (char_length(btrim(zone)) BETWEEN 1 AND 30);

ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS chk_restaurant_tables_number;
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT chk_restaurant_tables_number
    CHECK (number BETWEEN 1 AND 9999);

ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS chk_restaurant_tables_alias;
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT chk_restaurant_tables_alias
    CHECK (alias IS NULL OR char_length(btrim(alias)) BETWEEN 1 AND 30);

-- zone(30) + ' ' + number(4) + ' · ' + alias(30) = 68
ALTER TABLE public.restaurant_tables DROP CONSTRAINT IF EXISTS chk_restaurant_tables_name;
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT chk_restaurant_tables_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 68);

CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_tables_zone_number
    ON public.restaurant_tables (restaurant_id, lower(btrim(zone)), number);
DROP INDEX IF EXISTS public.uq_restaurant_tables_name;

COMMENT ON COLUMN public.restaurant_tables.name IS 'Nombre visible derivado por la aplicación: "<zona> <número>" o "<zona> <número> · <alias>". Nunca lo envía el cliente; orders.table_label guarda una copia al vender.';
COMMENT ON COLUMN public.restaurant_tables.zone IS 'Zona o salón de la mesa (p. ej. "Mesa", "Terraza"); texto normalizado (espacios colapsados, primera letra en mayúscula), 1-30 caracteres.';
COMMENT ON COLUMN public.restaurant_tables.number IS 'Número de la mesa dentro de su zona (1-9999). Único por restaurante y zona sin distinguir mayúsculas.';
COMMENT ON COLUMN public.restaurant_tables.alias IS 'Apodo opcional de la mesa (p. ej. "Ventana"), hasta 30 caracteres. La migración 0018 conserva aquí el nombre antiguo que no se pudo interpretar.';
