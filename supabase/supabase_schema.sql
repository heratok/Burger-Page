-- ============================================================================
-- SUPABASE COMPLETE SCHEMA: Multi-Tenant Sales Schema & Rosto Seed Data
-- File: supabase_schema.sql
-- Description: Production-ready PostgreSQL / Supabase schema for restaurants,
--              customers, products, orders, and inventory tables with RLS,
--              performance indexes, and complete seed data for 'rosto'.
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLES DEFINITION
-- ============================================================================

-- 1.1 RESTAURANTS (Tenants)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 CUSTOMERS (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT NOT NULL,
    address TEXT DEFAULT '',
    barrio TEXT DEFAULT '',
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'bronze',
    last_order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 PRODUCTS (Catalog / Menu)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC NOT NULL,
    category TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    additions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 ORDERS (Sales / POS)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total NUMERIC NOT NULL,
    delivery_fee NUMERIC NOT NULL DEFAULT 0,
    final_total NUMERIC NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_method TEXT DEFAULT 'Efectivo',
    payment_amount NUMERIC,
    change_amount NUMERIC,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 INVENTORY (Stock Control)
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_stock_alert NUMERIC NOT NULL DEFAULT 5,
    unit TEXT NOT NULL DEFAULT 'units',
    cost_per_unit NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. PERFORMANCE INDEXES
-- ============================================================================

-- Orders indexes (tenant queries, ordering, and customer lookups)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- Products index (menu category filtering per restaurant)
CREATE INDEX IF NOT EXISTS idx_products_restaurant_category ON public.products(restaurant_id, category);

-- Customers index (phone lookup per tenant)
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_phone ON public.customers(restaurant_id, phone);

-- Additional utility indexes for multi-tenancy & lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant_id ON public.inventory(restaurant_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 3.1 RESTAURANTS POLICIES
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

-- 3.2 CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Allow full access on customers" ON public.customers;
CREATE POLICY "Allow full access on customers"
    ON public.customers FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 3.3 PRODUCTS POLICIES
DROP POLICY IF EXISTS "Allow full access on products" ON public.products;
CREATE POLICY "Allow full access on products"
    ON public.products FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 3.4 ORDERS POLICIES
DROP POLICY IF EXISTS "Allow full access on orders" ON public.orders;
CREATE POLICY "Allow full access on orders"
    ON public.orders FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 3.5 INVENTORY POLICIES
DROP POLICY IF EXISTS "Allow full access on inventory" ON public.inventory;
CREATE POLICY "Allow full access on inventory"
    ON public.inventory FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 4. SEED DATA FOR RESTAURANT 'rosto'
-- ============================================================================

-- 4.1 RESTAURANT: 'rosto'
INSERT INTO public.restaurants (id, slug, name, tagline, opening_hours, is_active, config)
VALUES (
    'rosto',
    'rosto',
    'Rosto',
    'Sabor artesanal en cada bocado',
    '{"open":"12:00","close":"22:30"}'::jsonb,
    TRUE,
    '{
        "name": "Rosto",
        "tagline": "Sabor artesanal en cada bocado",
        "logoUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80",
        "bannerUrl": "https://images.unsplash.com/photo-1586816001966-79b736744398?w=1200&auto=format&fit=crop&q=80",
        "showBanner": true,
        "announcementText": "🍔 ¡Bienvenidos a Rosto! Hamburguesas artesanales de autor y papas rústicas",
        "showAnnouncement": true,
        "whatsappNumber": "573001234567",
        "currency": "COP",
        "currencySymbol": "$",
        "deliveryFee": 5000,
        "minOrderAmount": 20000,
        "estimatedDeliveryTime": "30 - 45 min",
        "openingHours": "12:00 - 22:30",
        "address": "Calle 72 # 11-85, Zona Gastronómica",
        "primaryColor": "#E63946",
        "primaryHoverColor": "#F25C69",
        "bgTheme": "dark-charcoal",
        "fontFamily": "sans",
        "cardRadius": "md",
        "cardStyle": "elevated",
        "compactGrid": false,
        "showBadges": true
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    opening_hours = EXCLUDED.opening_hours,
    is_active = EXCLUDED.is_active,
    config = EXCLUDED.config;

-- 4.2 PRODUCTS: 'rosto'
INSERT INTO public.products (id, restaurant_id, name, description, price, category, is_available, additions)
VALUES
    (
        'prod-rosto-1',
        'rosto',
        'Rosto Clásica',
        'Carne artesanal 180g, queso cheddar fundido, tocineta ahumada, lechuga fresca, tomate y salsa especial Rosto en pan brioche artesanal',
        26000,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-1", "name": "Extra Queso Cheddar", "price": 3000, "available": true}, {"id": "add-2", "name": "Tocineta Ahumada Extra", "price": 4000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-2',
        'rosto',
        'Rosto Doble Carne',
        'Doble porción de carne artesanal 180g (360g total), doble queso americano, tocineta caramelizada, cebolla crispy y salsa de la casa',
        34000,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-3", "name": "Huevo Frito con Yema Blanda", "price": 2500, "available": true}, {"id": "add-4", "name": "Cebolla Caramelizada", "price": 2000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-3',
        'rosto',
        'Rosto Crispy Chicken',
        'Pechuga de pollo empanizada ultra crocante, ensalada coleslaw fresca, pepinillos dulces y mayonesa de ajo asado',
        24000,
        'Hamburguesas',
        TRUE,
        '[{"id": "add-5", "name": "Tocineta Crispy", "price": 4000, "available": true}, {"id": "add-6", "name": "Salsa BBQ Ahumada", "price": 2000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-4',
        'rosto',
        'Papas Rústicas Rosto',
        'Papas cortadas en gajos rústicos sazonadas con sal marina, romero y paprika con salsa cheddar para acompañar',
        9000,
        'Acompañamientos',
        TRUE,
        '[{"id": "add-7", "name": "Salsa Cheddar Extra", "price": 2500, "available": true}, {"id": "add-8", "name": "Tocineta Picada", "price": 3000, "available": true}]'::jsonb
    ),
    (
        'prod-rosto-5',
        'rosto',
        'Aros de Cebolla Crocantes',
        '8 aros de cebolla rebozados y dorados a la perfección acompañados de salsa tártara artesanal',
        8500,
        'Acompañamientos',
        TRUE,
        '[]'::jsonb
    ),
    (
        'prod-rosto-6',
        'rosto',
        'Gaseosa Coca-Cola 400ml',
        'Gaseosa refrescante Coca-Cola Original bien fría',
        5000,
        'Bebidas',
        TRUE,
        '[]'::jsonb
    ),
    (
        'prod-rosto-7',
        'rosto',
        'Cerveza Club Colombia Dorada 330ml',
        'Cerveza premium tipo lager fría para maridar con tu hamburguesa',
        7000,
        'Bebidas',
        TRUE,
        '[]'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    is_available = EXCLUDED.is_available,
    additions = EXCLUDED.additions;

-- 4.3 CUSTOMERS: 'rosto'
INSERT INTO public.customers (id, restaurant_id, name, email, phone, address, barrio, total_orders, total_spent, loyalty_tier, last_order_date)
VALUES (
    'cust-rosto-1',
    'rosto',
    'Santiago Restrepo',
    'santiago.restrepo@example.com',
    '3109876543',
    'Carrera 15 # 88-21, Apto 302',
    'Chicó',
    3,
    84000,
    'silver',
    '2026-08-28 14:30:00+00'
)
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    barrio = EXCLUDED.barrio,
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent,
    loyalty_tier = EXCLUDED.loyalty_tier,
    last_order_date = EXCLUDED.last_order_date;

-- 4.4 ORDERS: 'rosto'
INSERT INTO public.orders (id, restaurant_id, order_number, customer_id, status, total, delivery_fee, final_total, items, payment_method, payment_amount, change_amount, comment, created_at, updated_at)
VALUES (
    'ord-rosto-101',
    'rosto',
    1001,
    'cust-rosto-1',
    'pending',
    35000,
    5000,
    40000,
    '[
        {
            "name": "Rosto Clásica",
            "price": 26000,
            "cantidad": 1,
            "total": 29000,
            "adiciones": [{"name": "Extra Queso Cheddar", "price": 3000, "cantidad": 1}]
        },
        {
            "name": "Papas Rústicas Rosto",
            "price": 9000,
            "cantidad": 1,
            "total": 9000
        }
    ]'::jsonb,
    'Efectivo',
    50000,
    10000,
    'Por favor enviar salsa extra de ajo y timbre 302',
    '2026-08-28 16:00:00+00',
    '2026-08-28 16:00:00+00'
)
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    order_number = EXCLUDED.order_number,
    customer_id = EXCLUDED.customer_id,
    status = EXCLUDED.status,
    total = EXCLUDED.total,
    delivery_fee = EXCLUDED.delivery_fee,
    final_total = EXCLUDED.final_total,
    items = EXCLUDED.items,
    payment_method = EXCLUDED.payment_method,
    payment_amount = EXCLUDED.payment_amount,
    change_amount = EXCLUDED.change_amount,
    comment = EXCLUDED.comment,
    updated_at = EXCLUDED.updated_at;

-- 4.5 INVENTORY: 'rosto'
INSERT INTO public.inventory (id, restaurant_id, name, category, current_stock, min_stock_alert, unit, cost_per_unit, updated_at)
VALUES
    ('inv-rosto-1', 'rosto', 'Carne Molida Artesanal 180g (Patties)', 'Ingredientes', 50, 15, 'unidades', 6500, NOW()),
    ('inv-rosto-2', 'rosto', 'Pan Brioche Rosto con Sésamo', 'Ingredientes', 45, 12, 'unidades', 2200, NOW()),
    ('inv-rosto-3', 'rosto', 'Queso Cheddar en Fetas', 'Ingredientes', 80, 20, 'unidades', 1100, NOW()),
    ('inv-rosto-4', 'rosto', 'Tocineta Ahumada de Cerdo', 'Ingredientes', 5.0, 2.0, 'kg', 28000, NOW()),
    ('inv-rosto-5', 'rosto', 'Papas Rústicas Pre-cortadas', 'Ingredientes', 20, 8, 'kg', 7500, NOW()),
    ('inv-rosto-6', 'rosto', 'Empaques Térmicos Rosto Kraft', 'Empaques', 120, 30, 'unidades', 600, NOW())
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    current_stock = EXCLUDED.current_stock,
    min_stock_alert = EXCLUDED.min_stock_alert,
    unit = EXCLUDED.unit,
    cost_per_unit = EXCLUDED.cost_per_unit,
    updated_at = EXCLUDED.updated_at;
