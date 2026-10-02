-- ============================================================================
-- 0000000000012_restaurants_deleted_at.down.sql
-- Restores the 0011 state. Deleted tenants become plain paused tenants
-- (is_active=false) again; their renamed slugs are kept.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

ALTER TABLE public.restaurants DROP COLUMN IF EXISTS deleted_at;
