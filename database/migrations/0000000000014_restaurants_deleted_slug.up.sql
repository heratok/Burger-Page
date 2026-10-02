-- ============================================================================
-- 0000000000014_restaurants_deleted_slug.up.sql
-- Deleted-tenant recovery (mirrors database/01_schema.sql):
--   restaurants.deleted_slug: the slug a tenant had when it was deleted. The
--   live slug is renamed with a '-deleted-<id>' suffix to free it for reuse;
--   keeping the original lets the super admin list and restore deleted tenants
--   without parsing the suffix.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- Nullable, no default: metadata-only change.
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS deleted_slug TEXT;

COMMENT ON COLUMN public.restaurants.deleted_slug IS 'Slug original del tenant al darlo de baja (el slug vigente se renombra con el sufijo -deleted-<id>). NULL mientras el tenant no esté dado de baja.';

-- Backfill tenants deleted before this column existed: strip the suffix the
-- delete appended. Only rows that still lack the value are touched, so a
-- re-run changes nothing.
UPDATE public.restaurants
   SET deleted_slug = CASE
         WHEN right(slug, length('-deleted-' || id)) = '-deleted-' || id
           THEN left(slug, length(slug) - length('-deleted-' || id))
         ELSE slug
       END
 WHERE deleted_at IS NOT NULL
   AND deleted_slug IS NULL;
