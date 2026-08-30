-- ============================================================================
-- BURGER-PAGE — Teardown: Drop All Tables, Functions & Extensions
-- File: teardown.sql
-- Run: Execute this file in the Supabase SQL Editor to wipe everything clean.
-- WARNING: This is DESTRUCTIVE and IRREVERSIBLE. All data will be lost.
-- ============================================================================

-- 1. Drop storage policies first (they reference storage.objects)
DROP POLICY IF EXISTS "storage_image_select_public"  ON storage.objects;
DROP POLICY IF EXISTS "storage_image_insert"         ON storage.objects;
DROP POLICY IF EXISTS "storage_image_update"         ON storage.objects;
DROP POLICY IF EXISTS "storage_image_delete"         ON storage.objects;
-- Legacy policy names (in case old schema was applied)
DROP POLICY IF EXISTS "Public Read Access on image bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access on image bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access on image bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access on image bucket" ON storage.objects;

-- 2. Drop storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'image';
DELETE FROM storage.buckets WHERE id = 'image';

-- 3. Drop tables (CASCADE removes indexes, triggers, policies, FKs)
DROP TABLE IF EXISTS public.orders     CASCADE;
DROP TABLE IF EXISTS public.inventory  CASCADE;
DROP TABLE IF EXISTS public.products   CASCADE;
DROP TABLE IF EXISTS public.customers  CASCADE;
DROP TABLE IF EXISTS public.users      CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;

-- 4. Drop functions
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- 5. Drop extensions (optional — other projects may need them)
-- Uncomment only if you're sure no other schema depends on these:
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
