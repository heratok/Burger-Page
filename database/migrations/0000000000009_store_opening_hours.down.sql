-- ============================================================================
-- 0000000000009_store_opening_hours.down.sql
-- Restores the 0008 state: restaurant_settings.open_time/close_time are the
-- single source of the hours again. They are refilled from the schedule (the
-- first range of the week per restaurant, lowest weekday then earliest start);
-- the rest of the weekly schedule, timezone and the paused flag are lost.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── T3. open_time/close_time back, refilled from the schedule ───────────────
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS open_time TIME DEFAULT '12:00',
    ADD COLUMN IF NOT EXISTS close_time TIME DEFAULT '22:30';

DO $$
BEGIN
    IF to_regclass('public.restaurant_opening_hours') IS NOT NULL THEN
        UPDATE public.restaurant_settings s
        SET open_time = f.open_time,
            close_time = f.close_time
        FROM (
            SELECT DISTINCT ON (restaurant_id) restaurant_id, open_time, close_time
            FROM public.restaurant_opening_hours
            ORDER BY restaurant_id, day_of_week, open_time
        ) f
        WHERE s.restaurant_id = f.restaurant_id;
    END IF;
END
$$;

COMMENT ON COLUMN public.restaurant_settings.open_time IS 'Hora de apertura del restaurante (fuente única del horario junto con close_time).';

-- ── T2. restaurant_opening_hours removed ────────────────────────────────────
-- Dropping the table also drops its policies, grants and constraints.
DROP TABLE IF EXISTS public.restaurant_opening_hours;

-- ── T1. timezone and orders_paused removed ──────────────────────────────────
ALTER TABLE public.restaurant_settings DROP CONSTRAINT IF EXISTS chk_restaurant_settings_timezone;
ALTER TABLE public.restaurant_settings
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS orders_paused;
