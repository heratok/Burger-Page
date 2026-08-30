-- ============================================================================
-- BURGER-PAGE — 100% Pure Relational Schema (PostgREST & Supabase Ready)
-- File: schema.sql
-- Description: Fully normalized relational DDL with ZERO unstructured JSONB blobs.
--              Includes FK relations, CHECK constraints, performance indexes,
--              updated_at triggers, granular RLS, and Storage bucket setup.
-- Run: Execute once in Supabase SQL Editor on a fresh database.
-- ============================================================================

-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. UTILITY FUNCTIONS & AUTOMATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. RELATIONAL TABLES DEFINITION
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants — fully normalized columns) -----------------------
CREATE TABLE public.restaurants (
    id                      TEXT PRIMARY KEY,
    slug                    TEXT UNIQUE NOT NULL,
    name                    TEXT NOT NULL,
    tagline                 TEXT,
    logo_url                TEXT,
    banner_url              TEXT,
    show_banner             BOOLEAN NOT NULL DEFAULT TRUE,
    announcement_text       TEXT,
    show_announcement       BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_number         TEXT,
    currency                TEXT NOT NULL DEFAULT 'COP',
    currency_symbol         TEXT NOT NULL DEFAULT '$',
    delivery_fee            NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    min_order_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
    estimated_delivery_time TEXT DEFAULT '30 - 45 min',
    opening_hours_text      TEXT DEFAULT '12:00 - 22:30',
    open_time               TIME DEFAULT '12:00',
    close_time              TIME DEFAULT '22:30',
    address                 TEXT,
    -- Theme & Visual Branding
    primary_color           TEXT NOT NULL DEFAULT '#E63946',
    primary_hover_color     TEXT NOT NULL DEFAULT '#F25C69',
    bg_theme                TEXT NOT NULL DEFAULT 'dark-charcoal'
                              CHECK (bg_theme IN ('dark-charcoal', 'deep-midnight', 'warm-cream', 'clean-white')),
    font_family             TEXT NOT NULL DEFAULT 'sans'
                              CHECK (font_family IN ('sans', 'serif', 'mono', 'display')),
    card_radius             TEXT NOT NULL DEFAULT 'md'
                              CHECK (card_radius IN ('sm', 'md', 'lg', 'full')),
    card_style              TEXT NOT NULL DEFAULT 'elevated'
                              CHECK (card_style IN ('elevated', 'bordered', 'glass', 'minimal')),
    compact_grid            BOOLEAN NOT NULL DEFAULT FALSE,
    show_badges             BOOLEAN NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 USERS (Authentication & Role-Based Access) ------------------------------
CREATE TABLE public.users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL
                    CHECK (role IN ('super_admin', 'restaurant_admin')),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_restaurant_admin_has_restaurant
        CHECK (role != 'restaurant_admin' OR restaurant_id IS NOT NULL)
);

-- 2.3 CATEGORIES (Relational Menu Sections) ----------------------------------
CREATE TABLE public.categories (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    slug          TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_categories_restaurant_name
        UNIQUE (restaurant_id, name)
);

-- 2.4 PRODUCTS (Menu Items) ---------------------------------------------------
CREATE TABLE public.products (
    id                       TEXT PRIMARY KEY,
    restaurant_id            TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id              TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name            TEXT NOT NULL,
    name                     TEXT NOT NULL,
    description              TEXT DEFAULT '',
    price                    NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    image_url                TEXT,
    is_available             BOOLEAN NOT NULL DEFAULT TRUE,
    is_popular               BOOLEAN NOT NULL DEFAULT FALSE,
    is_new                   BOOLEAN NOT NULL DEFAULT FALSE,
    preparation_time_minutes INTEGER DEFAULT 15 CHECK (preparation_time_minutes >= 0),
    display_order            INTEGER NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 PRODUCT ADDITIONS (Relational Modifiers / Extras) -----------------------
CREATE TABLE public.product_additions (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    product_id    TEXT REFERENCES public.products(id) ON DELETE CASCADE, -- NULL = available globally for restaurant
    name          TEXT NOT NULL,
    price         NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 CUSTOMERS (CRM) --------------------------------------------------------
CREATE TABLE public.customers (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT DEFAULT '',
    phone           TEXT NOT NULL,
    address         TEXT DEFAULT '',
    barrio          TEXT DEFAULT '',
    total_orders    INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
    total_spent     NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
    loyalty_tier    TEXT NOT NULL DEFAULT 'bronze'
                      CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'vip')),
    notes           TEXT,
    last_order_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customers_restaurant_phone
        UNIQUE (restaurant_id, phone)
);

-- 2.7 ORDERS (Sales Header / POS) ---------------------------------------------
CREATE TABLE public.orders (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number    INTEGER NOT NULL,
    customer_id     TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'cooking', 'delivering', 'delivered', 'cancelled')),
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    delivery_fee    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    final_total     NUMERIC(12, 2) NOT NULL CHECK (final_total >= 0),
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

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
CREATE TABLE public.order_items (
    id           TEXT PRIMARY KEY,
    order_id     TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id   TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Historical snapshot at time of sale
    unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal     NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    observation  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 ORDER ITEM ADDITIONS (Modifiers selected per order item) ---------------
CREATE TABLE public.order_item_additions (
    id            TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    addition_id   TEXT REFERENCES public.product_additions(id) ON DELETE SET NULL,
    addition_name TEXT NOT NULL, -- Historical snapshot
    unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total         NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 SUPPLIERS (Inventory Suppliers) ---------------------------------------
CREATE TABLE public.suppliers (
    id            TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    contact_name  TEXT DEFAULT '',
    phone         TEXT DEFAULT '',
    email         TEXT DEFAULT '',
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 INVENTORY ITEMS (Stock Control) ---------------------------------------
CREATE TABLE public.inventory_items (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    supplier_id     TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL
                      CHECK (category IN ('ingredients', 'beverages', 'packaging', 'cleaning', 'other')),
    current_stock   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(12, 2) NOT NULL DEFAULT 5.00 CHECK (min_stock_alert >= 0),
    unit            TEXT NOT NULL DEFAULT 'unidades'
                      CHECK (unit IN ('unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas')),
    cost_per_unit   NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_per_unit >= 0),
    last_restocked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TRIGGERS (Automate updated_at on all tables)
-- ============================================================================

CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_product_additions_updated_at
    BEFORE UPDATE ON public.product_additions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. PERFORMANCE INDEXES (Optimized for Multi-Tenancy & PostgREST Joins)
-- ============================================================================

-- Users
CREATE INDEX idx_users_username           ON public.users(username);
CREATE INDEX idx_users_restaurant_id      ON public.users(restaurant_id);

-- Categories
CREATE INDEX idx_categories_restaurant    ON public.categories(restaurant_id, display_order);

-- Products
CREATE INDEX idx_products_restaurant_cat  ON public.products(restaurant_id, category_id);
CREATE INDEX idx_products_available       ON public.products(restaurant_id, is_available);

-- Product Additions
CREATE INDEX idx_additions_restaurant_prod ON public.product_additions(restaurant_id, product_id);

-- Customers
CREATE INDEX idx_customers_rest_phone     ON public.customers(restaurant_id, phone);

-- Orders
CREATE INDEX idx_orders_rest_created      ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX idx_orders_rest_status       ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_customer          ON public.orders(customer_id);

-- Order Items & Line Additions (Crucial for PostgREST resource embedding)
CREATE INDEX idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id   ON public.order_items(product_id);
CREATE INDEX idx_order_item_additions_item ON public.order_item_additions(order_item_id);

-- Suppliers & Inventory
CREATE INDEX idx_suppliers_restaurant     ON public.suppliers(restaurant_id);
CREATE INDEX idx_inventory_rest_category  ON public.inventory_items(restaurant_id, category);
CREATE INDEX idx_inventory_supplier       ON public.inventory_items(supplier_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ============================================================================
-- Public anon users can only read active restaurants, categories, and available products.
-- Management/mutations and sensitive CRM/sales data are reserved for service_role / auth.
-- ============================================================================

ALTER TABLE public.restaurants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items      ENABLE ROW LEVEL SECURITY;

-- 5.1 Public Storefront Read Policies
CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

CREATE POLICY "public_read_available_products"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (is_available = TRUE);

CREATE POLICY "public_read_available_additions"
    ON public.product_additions FOR SELECT
    TO anon, authenticated
    USING (is_available = TRUE);

-- 5.2 Service Role Full Management (Bypasses RLS for backend API)
CREATE POLICY "service_manage_restaurants"          ON public.restaurants          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_users"                ON public.users                FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_categories"           ON public.categories           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_products"             ON public.products             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_product_additions"    ON public.product_additions    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_customers"            ON public.customers            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_orders"               ON public.orders               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_order_items"          ON public.order_items          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_order_item_additions" ON public.order_item_additions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_suppliers"            ON public.suppliers            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_manage_inventory_items"      ON public.inventory_items      FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. STORAGE BUCKET (Images CDN)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'image',
    'image',
    TRUE,
    10485760, -- 10 MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif'];

-- Storage Policies
CREATE POLICY "storage_image_select_public"
    ON storage.objects FOR SELECT
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');

CREATE POLICY "storage_image_insert"
    ON storage.objects FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (bucket_id = 'image');

CREATE POLICY "storage_image_update"
    ON storage.objects FOR UPDATE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image')
    WITH CHECK (bucket_id = 'image');

CREATE POLICY "storage_image_delete"
    ON storage.objects FOR DELETE
    TO anon, authenticated, service_role
    USING (bucket_id = 'image');
