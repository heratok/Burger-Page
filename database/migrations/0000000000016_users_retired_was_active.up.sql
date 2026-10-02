-- ============================================================================
-- 0000000000016_users_retired_was_active.up.sql
-- Restoring a deleted tenant must not re-enable users that were deactivated
-- before the delete (mirrors database/01_schema.sql):
--   users.retired_was_active: the is_active value a user had when its tenant
--   was deleted (retireByRestaurantId). Set at retire time, cleared at restore.
--   NULL = not retired, or retired before this column existed (prior state
--   unknown: restore treats it as active, the behavior before this change).
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- Nullable, no default: metadata-only change, no backfill.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS retired_was_active BOOLEAN;

COMMENT ON COLUMN public.users.retired_was_active IS 'is_active del usuario al darse de baja su restaurante; se usa para restaurarlo igual. NULL = no retirado o retirado antes de existir la columna (se restaura activo).';
