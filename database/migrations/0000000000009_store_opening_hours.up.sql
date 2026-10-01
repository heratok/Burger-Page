-- ============================================================================
-- 0000000000009_store_opening_hours.up.sql
-- Store opening hours (mirrors database/01_schema.sql):
--   T1  restaurant_settings.timezone (IANA name the hours are read in) and
--       restaurant_settings.orders_paused (manual "pause orders" switch).
--   T2  restaurant_opening_hours: the weekly schedule, one row per range.
--   T3  Backfill 7 rows per restaurant from open_time/close_time, then drop
--       those two columns: the weekly table is the single source of the hours.
--
-- A weekday with no row is closed; several rows per weekday are allowed;
-- close_time <= open_time means the range ends on the next day.
--
-- Every "-- ── T<n>." section marker below is relied on by the integration
-- tests that run a single section against a scratch database.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
--
-- Requires PostgreSQL 15+.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T1. restaurant_settings: timezone and orders_paused ─────────────────────
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    ADD COLUMN IF NOT EXISTS orders_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- "IANA-looking" only (Area/Location, UTC, Etc/GMT+5): the exact name is
-- verified by the application with Intl, which knows the runtime tz database.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_restaurant_settings_timezone'
          AND conrelid = 'public.restaurant_settings'::regclass
    ) THEN
        ALTER TABLE public.restaurant_settings
            ADD CONSTRAINT chk_restaurant_settings_timezone
            CHECK (timezone ~ '^[A-Za-z0-9_+/-]{1,64}$') NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.restaurant_settings VALIDATE CONSTRAINT chk_restaurant_settings_timezone;

COMMENT ON COLUMN public.restaurant_settings.timezone IS 'Zona horaria IANA en la que se interpreta el horario de atención (restaurant_opening_hours).';
COMMENT ON COLUMN public.restaurant_settings.orders_paused IS 'Interruptor manual: true detiene los pedidos públicos aunque el horario esté abierto.';

-- ── T2. restaurant_opening_hours: weekly schedule ───────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_opening_hours (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time     TIME NOT NULL,
    close_time    TIME NOT NULL,
    CONSTRAINT chk_restaurant_opening_hours_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT uq_restaurant_opening_hours_range
        UNIQUE (restaurant_id, day_of_week, open_time)
);

COMMENT ON TABLE public.restaurant_opening_hours IS 'Horario de atención semanal: un rango por fila; sin filas el día está cerrado; close_time <= open_time cruza la medianoche.';
COMMENT ON COLUMN public.restaurant_opening_hours.day_of_week IS '0 = Domingo ... 6 = Sábado.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_opening_hours TO app_user;

ALTER TABLE public.restaurant_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_opening_hours FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_restaurant_opening_hours" ON public.restaurant_opening_hours;
CREATE POLICY "public_read_restaurant_opening_hours"
    ON public.restaurant_opening_hours FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_opening_hours.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_restaurant_opening_hours" ON public.restaurant_opening_hours;
CREATE POLICY "tenant_isolation_restaurant_opening_hours" ON public.restaurant_opening_hours
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- ── T3. Backfill the weekly schedule, then drop open_time/close_time ────────
-- Every restaurant gets its current hours on all 7 days (the defaults 12:00 and
-- 22:30 stand in for a NULL time, as the application did). Restaurants that
-- already have rows are left alone, so a re-run never duplicates anything. The
-- statement is dynamic because the columns no longer exist after the first run.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'restaurant_settings'
          AND column_name = 'open_time'
    ) THEN
        EXECUTE $sql$
            INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
            SELECT 'oh_' || gen_random_uuid()::text,
                   r.id,
                   d,
                   COALESCE(s.open_time, TIME '12:00'),
                   COALESCE(s.close_time, TIME '22:30')
            FROM public.restaurants r
            LEFT JOIN public.restaurant_settings s ON s.restaurant_id = r.id
            CROSS JOIN generate_series(0, 6) AS d
            WHERE NOT EXISTS (
                SELECT 1 FROM public.restaurant_opening_hours h WHERE h.restaurant_id = r.id
            )
        $sql$;
    END IF;
END
$$;

ALTER TABLE public.restaurant_settings
    DROP COLUMN IF EXISTS open_time,
    DROP COLUMN IF EXISTS close_time;
