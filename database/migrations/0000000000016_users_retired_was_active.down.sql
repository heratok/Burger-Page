-- ============================================================================
-- 0000000000016_users_retired_was_active.down.sql
-- Restores the 0015 state. Retired users lose the captured prior state, so a
-- later restore re-enables all of them (the pre-0016 behavior).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

ALTER TABLE public.users DROP COLUMN IF EXISTS retired_was_active;
