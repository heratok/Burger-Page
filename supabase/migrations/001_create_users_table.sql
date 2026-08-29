-- ============================================================================
-- MIGRATION: Create users table for authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'restaurant_admin')),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_restaurant_admin_has_restaurant
        CHECK (role != 'restaurant_admin' OR restaurant_id IS NOT NULL)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON public.users(restaurant_id);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on users" ON public.users;
CREATE POLICY "Allow full access on users"
    ON public.users FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Seed: default super admin (password: "admin123456")
-- Hash generated with scrypt, salt:key format
-- In production, create via the API instead of seeding
INSERT INTO public.users (id, username, password_hash, role)
VALUES (
    'user-super-admin',
    'superadmin',
    'seed_placeholder:change_via_api',
    'super_admin'
)
ON CONFLICT (id) DO NOTHING;
