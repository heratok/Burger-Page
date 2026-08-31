-- ============================================================================
-- BURGER-PAGE — Pure Relational Schema (Postgres-Portable, Supabase-Compatible)
-- File: schema.sql
-- Description: Fully normalized relational DDL with ZERO unstructured JSONB
--              blobs. Written for a setup where a SINGLE trusted backend
--              (Fastify, hexagonal architecture) is the only thing that talks
--              to Postgres. Tenant isolation and atomic transactions are 
--              orchestrated from TypeScript use cases and repositories.
--
-- Run: Execute once on a fresh database.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- 1. UTILITY FUNCTIONS & AUTOMATIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- 2. RELATIONAL TABLES DEFINITION
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants) --------------------------------------------------
CREATE TABLE public.restaurants (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 2.1.1 RESTAURANT HOURS -----------------------------------------------------
CREATE TABLE public.restaurant_hours (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id  TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    open_time      TIME,
    close_time     TIME,
    is_closed      BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_restaurant_hours_day
        UNIQUE (restaurant_id, day_of_week),
    CONSTRAINT chk_hours_consistent
        CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

-- 2.2 USERS (Authentication & Role-Based Access) -----------------------------
CREATE TABLE public.users (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_id_restaurant
        UNIQUE (id, restaurant_id)
);

-- 2.5 PRODUCT ADDITIONS (Relational Modifiers / Extras) ----------------------
CREATE TABLE public.product_additions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    product_id    TEXT, -- NULL = global for restaurant
    name          TEXT NOT NULL,
    price         NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_additions_product_restaurant
        FOREIGN KEY (product_id, restaurant_id)
        REFERENCES public.products(id, restaurant_id)
        ON DELETE CASCADE
);

-- 2.6 CUSTOMERS (CRM) --------------------------------------------------------
CREATE TABLE public.customers (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    email           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    barrio          TEXT DEFAULT '',
    notes           TEXT,
    -- Fast-read metrics maintained automatically by trigger inside order transactions
    total_orders    INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
    total_spent     NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
    loyalty_tier    TEXT NOT NULL DEFAULT 'bronze'
                      CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'vip')),
    last_order_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_restaurant_phone
        UNIQUE (restaurant_id, phone),
    CONSTRAINT uq_customers_id_restaurant
        UNIQUE (id, restaurant_id)
);

-- 2.6.1 RESTAURANT ORDER COUNTERS --------------------------------------------
CREATE TABLE public.restaurant_order_counters (
    restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    last_number   INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- 2.7 ORDERS (Sales Header / POS) --------------------------------------------
CREATE TABLE public.orders (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number    INTEGER, -- auto-assigned by trigger if left NULL
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

-- 2.7.1 ORDER STATUS HISTORY --------------------------------------------------
CREATE TABLE public.order_status_history (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id    TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    old_status  TEXT,
    new_status  TEXT NOT NULL,
    changed_by  TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
CREATE TABLE public.order_items (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id     TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id   TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- historical snapshot at time of sale
    unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal     NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    observation  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 ORDER ITEM ADDITIONS (Modifiers selected per order item) --------------
CREATE TABLE public.order_item_additions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_item_id TEXT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    addition_id   TEXT REFERENCES public.product_additions(id) ON DELETE SET NULL,
    addition_name TEXT NOT NULL, -- historical snapshot
    unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total         NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 SUPPLIERS (Inventory Suppliers) ---------------------------------------
CREATE TABLE public.suppliers (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    contact_name  TEXT DEFAULT '',
    phone         TEXT DEFAULT '',
    email         TEXT DEFAULT '',
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_suppliers_id_restaurant
        UNIQUE (id, restaurant_id)
);

-- 2.11 INVENTORY ITEMS (Raw Materials, Ingredients, Supplies) ----------------
CREATE TABLE public.inventory_items (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'ingredients'
                      CHECK (category IN ('ingredients', 'beverages', 'packaging', 'cleaning', 'other')),
    current_stock   NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_stock >= 0),
    min_stock_alert NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_stock_alert >= 0),
    unit            TEXT NOT NULL DEFAULT 'unidades'
                      CHECK (unit IN ('unidades', 'kg', 'g', 'litros', 'paquetes', 'cajas')),
    cost_per_unit   NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_per_unit >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_items_restaurant_name
        UNIQUE (restaurant_id, name),
    CONSTRAINT uq_inventory_items_id_restaurant
        UNIQUE (id, restaurant_id)
);


-- ============================================================================
-- 3. TRIGGERS (Automations inside Postgres Transactions)
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

-- 3.1 Concurrency-safe per-restaurant order_number ---------------------------
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    IF NEW.order_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.restaurant_order_counters (restaurant_id, last_number)
    VALUES (NEW.restaurant_id, 1)
    ON CONFLICT (restaurant_id)
    DO UPDATE SET last_number = public.restaurant_order_counters.last_number + 1
    RETURNING last_number INTO v_next;

    NEW.order_number := v_next;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_assign_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- 3.2 Auto-log status changes -------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NULL, NEW.status, NULLIF(current_setting('app.actor', true), ''));
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, NULLIF(current_setting('app.actor', true), ''));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_log_status
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- 3.3 Atomic Customer Order Metrics Trigger -----------------------------------
-- Automatically aggregates total_orders, total_spent, and last_order_date
-- into the customers table DENTRO of the exact same SQL transaction.
CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_id TEXT;
    v_total_orders INTEGER;
    v_total_spent NUMERIC(12, 2);
    v_last_order_date TIMESTAMPTZ;
BEGIN
    v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    IF v_customer_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT 
        COUNT(*),
        COALESCE(SUM(final_total), 0.00),
        MAX(created_at)
    INTO 
        v_total_orders,
        v_total_spent,
        v_last_order_date
    FROM public.orders
    WHERE customer_id = v_customer_id
      AND status != 'cancelled';

    UPDATE public.customers
    SET 
        total_orders = v_total_orders,
        total_spent = v_total_spent,
        last_order_date = v_last_order_date,
        updated_at = NOW()
    WHERE id = v_customer_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_update_customer_metrics
    AFTER INSERT OR UPDATE OF status, final_total, customer_id OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_customer_order_metrics();

-- 3.3 Concurrency-safe atomic inventory stock adjustment -----------------------
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
    p_id TEXT,
    p_restaurant_id TEXT,
    p_delta NUMERIC
)
RETURNS SETOF public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_delta < 0 THEN
        RETURN QUERY
        UPDATE public.inventory_items
        SET current_stock = current_stock + p_delta,
            updated_at = NOW()
        WHERE id = p_id
          AND restaurant_id = p_restaurant_id
          AND current_stock >= ABS(p_delta)
        RETURNING *;
    ELSE
        RETURN QUERY
        UPDATE public.inventory_items
        SET current_stock = current_stock + p_delta,
            updated_at = NOW()
        WHERE id = p_id
          AND restaurant_id = p_restaurant_id
        RETURNING *;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO postgres;


-- ============================================================================
-- 4. PERFORMANCE INDEXES (Multi-Tenancy & Query Patterns)
-- ============================================================================
CREATE INDEX idx_users_username            ON public.users(username);
CREATE INDEX idx_users_restaurant_id       ON public.users(restaurant_id);
CREATE INDEX idx_categories_restaurant     ON public.categories(restaurant_id, display_order);
CREATE INDEX idx_products_restaurant_cat   ON public.products(restaurant_id, category_id);
CREATE INDEX idx_products_available        ON public.products(restaurant_id, is_available);
CREATE INDEX idx_additions_restaurant_prod ON public.product_additions(restaurant_id, product_id);
CREATE INDEX idx_customers_rest_phone      ON public.customers(restaurant_id, phone);
CREATE INDEX idx_orders_rest_created       ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX idx_orders_rest_status        ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_customer           ON public.orders(customer_id);
CREATE INDEX idx_order_items_order_id      ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id    ON public.order_items(product_id);
CREATE INDEX idx_order_item_additions_item ON public.order_item_additions(order_item_id);
CREATE INDEX idx_order_status_history_order ON public.order_status_history(order_id, changed_at DESC);
CREATE INDEX idx_restaurant_hours_rest     ON public.restaurant_hours(restaurant_id);
CREATE INDEX idx_suppliers_restaurant      ON public.suppliers(restaurant_id);
CREATE INDEX idx_inventory_items_restaurant ON public.inventory_items(restaurant_id);
CREATE INDEX idx_inventory_items_low_stock  ON public.inventory_items(restaurant_id, current_stock);


-- ============================================================================
-- 5. ROW LEVEL SECURITY (Storefront Safety Net)
-- ============================================================================
ALTER TABLE public.restaurants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_hours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "public_read_restaurant_hours"
    ON public.restaurant_hours FOR SELECT
    USING (TRUE);

CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "public_read_available_products"
    ON public.products FOR SELECT
    USING (is_available = TRUE);

CREATE POLICY "public_read_available_additions"
    ON public.product_additions FOR SELECT
    USING (is_available = TRUE);
