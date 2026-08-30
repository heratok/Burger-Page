-- ============================================================================
-- SUPABASE-ONLY EXTENSION — Image Storage Bucket
-- File: supabase_storage_extension.sql
-- Run this ONLY while you're still hosted on Supabase, AFTER schema.sql.
-- It will NOT run on plain Postgres — the `storage` schema is a Supabase
-- product feature, not core Postgres. When you migrate off Supabase, drop
-- this file and move image uploads to S3/R2/MinIO from your backend instead
-- (the schema already just stores plain URLs in logo_url/banner_url/image_url,
-- so no other table changes are needed).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'image',
    'image',
    TRUE,
    10485760, -- 10 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'];

-- Anyone can VIEW images (public storefront needs this).
CREATE POLICY "storage_image_select_public"
    ON storage.objects FOR SELECT
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');

-- Only logged-in/backend roles can upload/modify/delete — anon was removed
-- here vs. the original (anon write access let anyone flood your bucket).
CREATE POLICY "storage_image_insert"
    ON storage.objects FOR INSERT
    TO authenticated, service_role
    WITH CHECK (bucket_id = 'image');

CREATE POLICY "storage_image_update"
    ON storage.objects FOR UPDATE
    TO authenticated, service_role
    USING (bucket_id = 'image')
    WITH CHECK (bucket_id = 'image');

CREATE POLICY "storage_image_delete"
    ON storage.objects FOR DELETE
    TO authenticated, service_role
    USING (bucket_id = 'image');

-- TIP: prefix uploaded object paths with the restaurant_id, e.g.
--   image/{restaurant_id}/logo.png
-- so you can later tighten these policies to check the path prefix against
-- the caller's own restaurant_id instead of allowing any authenticated user
-- to write anywhere in the bucket.