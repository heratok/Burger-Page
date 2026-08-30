-- ============================================================================
-- BURGER-PAGE — Complete Database Teardown / Reset Script
-- File: teardown.sql
-- Description: Completely wipes all tables, foreign keys, triggers, RLS policies,
--              functions, and storage objects. Leaves database 100% clean.
-- WARNING: Destructive and irreversible. All data will be permanently deleted.
-- ============================================================================

-- 1. DROP STORAGE POLICIES & BUCKET
-- ============================================================================
DROP POLICY IF EXISTS "storage_image_select_public"  ON storage.objects;
DROP POLICY IF EXISTS "storage_image_insert"         ON storage.objects;
DROP POLICY IF EXISTS "storage_image_update"         ON storage.objects;
DROP POLICY IF EXISTS "storage_image_delete"         ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access on image bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access on image bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access on image bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access on image bucket" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'image';
DELETE FROM storage.buckets WHERE id = 'image';

-- 2. DROP ALL TABLES (CASCADE automatically drops indexes, triggers, and FKs)
-- ============================================================================
DROP TABLE IF EXISTS public.order_item_additions CASCADE;
DROP TABLE IF EXISTS public.order_items          CASCADE;
DROP TABLE IF EXISTS public.orders               CASCADE;
DROP TABLE IF EXISTS public.customers            CASCADE;
DROP TABLE IF EXISTS public.product_additions    CASCADE;
DROP TABLE IF EXISTS public.products             CASCADE;
DROP TABLE IF EXISTS public.categories           CASCADE;
DROP TABLE IF EXISTS public.inventory_items      CASCADE;
DROP TABLE IF EXISTS public.inventory            CASCADE; -- Legacy fallback
DROP TABLE IF EXISTS public.suppliers            CASCADE;
DROP TABLE IF EXISTS public.users                CASCADE;
DROP TABLE IF EXISTS public.restaurants          CASCADE;

-- 3. DROP AUTOMATION FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
