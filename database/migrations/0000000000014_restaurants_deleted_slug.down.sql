-- ============================================================================
-- 0000000000014_restaurants_deleted_slug.down.sql
-- Restores the 0013 state. Deleted tenants keep their renamed slug; the
-- original slug is still recoverable from the '-deleted-<id>' suffix.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

ALTER TABLE public.restaurants DROP COLUMN IF EXISTS deleted_slug;
