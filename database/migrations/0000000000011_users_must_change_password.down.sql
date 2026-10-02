-- ============================================================================
-- 0000000000011_users_must_change_password.down.sql
-- Restores the 0010 state. Pending forced password changes are forgotten
-- (users keep the temporary password they were given).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

ALTER TABLE public.users DROP COLUMN IF EXISTS must_change_password;
