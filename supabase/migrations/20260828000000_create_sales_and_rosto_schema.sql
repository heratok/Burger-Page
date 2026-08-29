-- ============================================================================
-- SUPABASE MIGRATION: Multi-Tenant Sales Schema (DDL Only)
-- Migration: 20260828000000_create_sales_and_rosto_schema.sql
-- Description: Creates restaurants, customers, products, orders, and inventory
--              tables with RLS, performance indexes, and updated_at triggers.
--              Does NOT include demo or tenant-specific seed data.
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. FUNCTIONS & TRIGGERS (Automations)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABLES DEFINITION
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 CUSTOMERS (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT NOT NULL,
    address TEXT DEFAULT '',
    barrio TEXT DEFAULT '',
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(12, 2) DEFAULT 0.00,
    loyalty_tier TEXT DEFAULT 'bronze',
    last_order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 PRODUCTS (Catalog / Menu)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    additions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 ORDERS (Sales / POS)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total NUMERIC(12, 2) NOT NULL,
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    final_total NUMERIC(12, 2) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_method TEXT DEFAULT 'Efectivo',
    payment_amount NUMERIC(12, 2),
    change_amount NUMERIC(12, 2),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 INVENTORY (Stock Control)
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
    unit TEXT NOT NULL DEFAULT 'units',
    cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. ATTACH TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_inventory_updated_at ON public.inventory;
CREATE TRIGGER trigger_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

-- Orders indexes (tenant queries, timeline sorting, status kanban, customer history)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- Products index (menu category filtering per restaurant)
CREATE INDEX IF NOT EXISTS idx_products_restaurant_category ON public.products(restaurant_id, category);

-- Customers index (phone lookup per tenant)
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_phone ON public.customers(restaurant_id, phone);

-- Inventory index (stock list per tenant)
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant_id ON public.inventory(restaurant_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 5.1 RESTAURANTS POLICIES
DROP POLICY IF EXISTS "Allow public read access on restaurants" ON public.restaurants;
CREATE POLICY "Allow public read access on restaurants"
    ON public.restaurants FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow full management on restaurants" ON public.restaurants;
CREATE POLICY "Allow full management on restaurants"
    ON public.restaurants FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5.2 CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Allow full access on customers" ON public.customers;
CREATE POLICY "Allow full access on customers"
    ON public.customers FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5.3 PRODUCTS POLICIES
DROP POLICY IF EXISTS "Allow full access on products" ON public.products;
CREATE POLICY "Allow full access on products"
    ON public.products FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5.4 ORDERS POLICIES
DROP POLICY IF EXISTS "Allow full access on orders" ON public.orders;
CREATE POLICY "Allow full access on orders"
    ON public.orders FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5.5 INVENTORY POLICIES
DROP POLICY IF EXISTS "Allow full access on inventory" ON public.inventory;
CREATE POLICY "Allow full access on inventory"
    ON public.inventory FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
