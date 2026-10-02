-- ============================================================================
-- 0000000000011_users_must_change_password.up.sql
-- Forced password change (mirrors database/01_schema.sql):
--   users.must_change_password: set when a super admin resets a user's
--   password to a temporary one. While true, the API only lets that user
--   change their own password.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- NOT NULL DEFAULT false is a metadata-only change on PostgreSQL 11+, so
-- existing rows are not rewritten and every current account keeps working.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.must_change_password IS 'true tras un reseteo de contraseña por el super admin: el usuario solo puede cambiar su propia contraseña hasta hacerlo.';

-- look_up_user_for_auth(_by_id) return SETOF public.users, so the new column
-- is exposed to the login path without redefining them.
