-- ============================================================================
-- 0000000000013_users_password_changed_at.up.sql
-- Session revocation on password change (mirrors database/01_schema.sql):
--   users.password_changed_at: stamped when a password is changed or reset.
--   The auth middleware rejects session tokens whose `iat` is earlier than it,
--   so a reset/change kicks out anyone holding a token issued before it.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- Nullable, no default: metadata-only. NULL means "never changed", so every
-- existing token keeps working until its owner's next password change.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.password_changed_at IS 'Instante del último cambio/reseteo de contraseña. Los tokens emitidos antes (iat) se rechazan. NULL = nunca cambiada.';

-- look_up_user_for_auth(_by_id) return SETOF public.users, so the new column
-- is exposed to the login/revalidation path without redefining them.
