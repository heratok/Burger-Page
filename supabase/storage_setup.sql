-- ============================================================================
-- SUPABASE STORAGE SETUP: Bucket 'image' & Public RLS Policies
-- File: storage_setup.sql
-- Description: Configures the 'image' bucket for public CDN reading and
--              direct uploads for restaurant menu photos, logos, and banners.
-- ============================================================================

-- 1. Ensure bucket 'image' exists and is marked public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'image',
    'image',
    TRUE,
    10485760, -- 10MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'];

-- 2. Policy: Public Read Access (Anyone can see menu pictures and storefront images)
DROP POLICY IF EXISTS "Public Read Access on image bucket" ON storage.objects;
CREATE POLICY "Public Read Access on image bucket"
    ON storage.objects FOR SELECT
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');

-- 3. Policy: Upload Access (Restaurant owners can upload optimized WebP images)
DROP POLICY IF EXISTS "Public Upload Access on image bucket" ON storage.objects;
CREATE POLICY "Public Upload Access on image bucket"
    ON storage.objects FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (bucket_id = 'image');

-- 4. Policy: Update/Upsert Access
DROP POLICY IF EXISTS "Public Update Access on image bucket" ON storage.objects;
CREATE POLICY "Public Update Access on image bucket"
    ON storage.objects FOR UPDATE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image')
    WITH CHECK (bucket_id = 'image');

-- 5. Policy: Delete Access
DROP POLICY IF EXISTS "Public Delete Access on image bucket" ON storage.objects;
CREATE POLICY "Public Delete Access on image bucket"
    ON storage.objects FOR DELETE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');
