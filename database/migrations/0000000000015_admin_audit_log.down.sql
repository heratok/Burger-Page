-- ============================================================================
-- 0000000000015_admin_audit_log.down.sql
-- Restores the 0014 state. The whole audit history is lost.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- Dropping the table also drops its policies, trigger, grants and indexes.
DROP TABLE IF EXISTS public.admin_audit_log;
DROP FUNCTION IF EXISTS public.guard_admin_audit_log_immutable();
