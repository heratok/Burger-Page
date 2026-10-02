-- ============================================================================
-- 0000000000013_users_password_changed_at.down.sql
-- Restores the 0012 state. Tokens issued before past password changes become
-- valid again until they expire.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

ALTER TABLE public.users DROP COLUMN IF EXISTS password_changed_at;
