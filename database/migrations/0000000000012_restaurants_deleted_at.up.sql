-- ============================================================================
-- 0000000000012_restaurants_deleted_at.up.sql
-- Restaurant delete distinct from pause (mirrors database/01_schema.sql):
--   restaurants.deleted_at: set when a super admin deletes a tenant. Paused
--   tenants keep is_active=false with deleted_at NULL and stay listed and
--   editable; deleted tenants are hidden from every app read.
--
-- There is no restaurants.admin_password column to clear: the plaintext admin
-- password was only ever held in memory by the app, never stored here.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- Nullable, no default: metadata-only change, existing rows are untouched.
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.restaurants.deleted_at IS 'Baja lógica del tenant (distinta de pausar con is_active=false): la app lo oculta de listados y búsquedas y renombra el slug para liberarlo.';
