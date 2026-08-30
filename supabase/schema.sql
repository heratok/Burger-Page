-- ============================================================================
-- BURGER-PAGE — Complete Database Schema (DDL Only)
-- File: schema.sql
-- Run: Execute this file once in a fresh Supabase project (SQL Editor).
-- ============================================================================

-- 0. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants) ---------------------------------------------------
CREATE TABLE public.restaurants (
    id          TEXT PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    tagline     TEXT,
    config      JSONB   NOT NULL DEFAULT '{}'::jsonb,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    categories  JSONB   NOT NULL DEFAULT '[]'::jsonb,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 USERS (Authentication) -------------------------------------------------
CREATE TABLE public.users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL
                    CHECK (role IN ('super_admin', 'restaurant_admin')),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_restaurant_admin_has_restaurant
        CHECK (role != 'restaurant_admin' OR restaurant_id IS NOT NULL)
);

-- 2.3 CUSTOMERS (CRM) --------------------------------------------------------
CREATE TABLE public.customers (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT DEFAULT '',
    phone           TEXT NOT NULL,
    address         TEXT DEFAULT '',
    barrio          TEXT DEFAULT '',
    total_orders    INTEGER  NOT NULL DEFAULT 0  CHECK (total_orders >= 0),
    total_spent     NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
    loyalty_tier    TEXT NOT NULL DEFAULT 'bronze'
                      CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'vip')),
    last_order_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customers_restaurant_phone
        UNIQUE (restaurant_id, phone)
);

-- 2.4 PRODUCTS (Catalog / Menu) -----------------------------------------------
CREATE TABLE public.products (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    price         NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    category      TEXT NOT NULL,
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    additions     JSONB   NOT NULL DEFAULT '[]'::jsonb,
    image_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 ORDERS (Sales / POS) ----------------------------------------------------
CREATE TABLE public.orders (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number    INTEGER NOT NULL,
    customer_id     TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'cooking', 'delivering', 'delivered', 'cancelled')),
    total           NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    delivery_fee    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    final_total     NUMERIC(12, 2) NOT NULL CHECK (final_total >= 0),
    items           JSONB   NOT NULL DEFAULT '[]'::jsonb,
    payment_method  TEXT NOT NULL DEFAULT 'Efectivo'
                      CHECK (payment_method IN ('Efectivo', 'Transferencia')),
    payment_amount  NUMERIC(12, 2) CHECK (payment_amount IS NULL OR payment_amount >= 0),
    change_amount   NUMERIC(12, 2) CHECK (change_amount IS NULL OR change_amount >= 0),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_orders_restaurant_order_number
        UNIQUE (restaurant_id, order_number)
);

-- 2.6 INVENTORY (Stock Control) -----------------------------------------------
CREATE TABLE public.inventory (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    current_stock   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(12, 2) NOT NULL DEFAULT 5.00 CHECK (min_stock_alert >= 0),
    unit            TEXT NOT NULL DEFAULT 'unidades'
                      CHECK (unit IN ('unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas')),
    cost_per_unit   NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_per_unit >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TRIGGERS (auto-update updated_at)
-- ============================================================================

CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

-- Users
CREATE INDEX idx_users_username       ON public.users(username);
CREATE INDEX idx_users_restaurant_id  ON public.users(restaurant_id);

-- Orders (tenant timeline, status kanban, customer history)
CREATE INDEX idx_orders_restaurant_created  ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX idx_orders_restaurant_status   ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_customer_id         ON public.orders(customer_id);

-- Products (menu category filter per tenant)
CREATE INDEX idx_products_restaurant_category ON public.products(restaurant_id, category);

-- Customers (phone lookup per tenant)
CREATE INDEX idx_customers_restaurant_phone ON public.customers(restaurant_id, phone);

-- Inventory (stock list per tenant)
CREATE INDEX idx_inventory_restaurant_id ON public.inventory(restaurant_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- The backend uses the service_role key which BYPASSES RLS automatically.
-- These policies protect against direct access from the browser (anon key).
-- ============================================================================

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory   ENABLE ROW LEVEL SECURITY;

-- 5.1 RESTAURANTS — Public storefront reads; mutations via backend only
CREATE POLICY "restaurants_select_public"
    ON public.restaurants FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "restaurants_manage_service"
    ON public.restaurants FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.2 USERS — Backend only (auth is handled server-side)
CREATE POLICY "users_manage_service"
    ON public.users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.3 CUSTOMERS — Backend only
CREATE POLICY "customers_manage_service"
    ON public.customers FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.4 PRODUCTS — Public reads; mutations via backend only
CREATE POLICY "products_select_public"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "products_manage_service"
    ON public.products FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.5 ORDERS — Backend only
CREATE POLICY "orders_manage_service"
    ON public.orders FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5.6 INVENTORY — Backend only
CREATE POLICY "inventory_manage_service"
    ON public.inventory FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 6. STORAGE BUCKET (Images CDN)
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

-- Storage: Public read
CREATE POLICY "storage_image_select_public"
    ON storage.objects FOR SELECT
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');

-- Storage: Upload via backend
CREATE POLICY "storage_image_insert"
    ON storage.objects FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (bucket_id = 'image');

-- Storage: Update via backend
CREATE POLICY "storage_image_update"
    ON storage.objects FOR UPDATE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image')
    WITH CHECK (bucket_id = 'image');

-- Storage: Delete via backend
CREATE POLICY "storage_image_delete"
    ON storage.objects FOR DELETE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');
