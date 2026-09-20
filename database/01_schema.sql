-- ============================================================================
-- BURGER-PAGE — Pure PostgreSQL Canonical Relational Schema
-- File: database/schema.sql
-- Description: Standard, vendor-neutral PostgreSQL DDL (Postgres 14+).
--              Designed for a trusted backend (Fastify, hexagonal architecture)
--              using standard 'pg' pool with multi-tenant isolation via
--              PostgreSQL Row Level Security (RLS) and session-level GUCs.
--
-- Compatibility: 100% standard PostgreSQL. Runs identically on:
--   - Local PostgreSQL (Docker, bare metal)
--   - Supabase (via SQL Editor or direct postgres connection)
--   - AWS RDS / Aurora / Neon / Render / Railway
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS & ROLES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Application role for the backend connection pool (without BYPASSRLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'app_user_test_only';
    ELSE
        ALTER ROLE app_user WITH PASSWORD 'app_user_test_only';
    END IF;
END $$;


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
-- 2. RELATIONAL TABLES
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants) --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
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
CREATE TABLE IF NOT EXISTS public.restaurant_hours (
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

-- 2.2 USERS (Authentication & Role-Based Access Control) -----------------------
CREATE TABLE IF NOT EXISTS public.users (
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
CREATE TABLE IF NOT EXISTS public.categories (
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
CREATE TABLE IF NOT EXISTS public.products (
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

-- 2.5 PRODUCT ADDITIONS (Modifiers & Extras) ---------------------------------
CREATE TABLE IF NOT EXISTS public.product_additions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    product_id    TEXT, -- NULL = global addition for restaurant
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
CREATE TABLE IF NOT EXISTS public.customers (
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
CREATE TABLE IF NOT EXISTS public.restaurant_order_counters (
    restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    last_number   INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- 2.7 ORDERS (Sales Header / POS) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
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
    receipt_url     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_orders_restaurant_order_number
        UNIQUE (restaurant_id, order_number)
);

-- 2.7.1 ORDER STATUS HISTORY --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    old_status    TEXT,
    new_status    TEXT NOT NULL,
    changed_by    TEXT,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    product_id    TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL, -- historical snapshot at time of sale
    unit_price    NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal      NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    observation   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 ORDER ITEM ADDITIONS (Modifiers selected per order item) --------------
CREATE TABLE IF NOT EXISTS public.order_item_additions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_item_id TEXT NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    addition_id   TEXT REFERENCES public.product_additions(id) ON DELETE SET NULL,
    addition_name TEXT NOT NULL, -- historical snapshot
    unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total         NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 SUPPLIERS (Inventory Suppliers) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
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
CREATE TABLE IF NOT EXISTS public.inventory_items (
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

-- 3.0 Updated_at auto-management
DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_product_additions_updated_at ON public.product_additions;
CREATE TRIGGER trg_product_additions_updated_at
    BEFORE UPDATE ON public.product_additions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON public.inventory_items;
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

DROP TRIGGER IF EXISTS trg_orders_assign_number ON public.orders;
CREATE TRIGGER trg_orders_assign_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- 3.2 Auto-log status changes with actor audit --------------------------------
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NEW.restaurant_id, NULL, NEW.status, NULLIF(current_setting('app.actor', true), ''));
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NEW.restaurant_id, OLD.status, NEW.status, NULLIF(current_setting('app.actor', true), ''));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_log_status ON public.orders;
CREATE TRIGGER trg_orders_log_status
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- 3.3 Atomic Customer Order Metrics Trigger -----------------------------------
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
    -- NEW is an unassigned record in DELETE triggers: pick the row
    -- source by operation before touching any column (previously this
    -- COALESCE ran unconditionally and every DELETE on public.orders
    -- raised 'record "new" is not assigned yet').
    IF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
    ELSE
        v_customer_id := NEW.customer_id;
    END IF;
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

DROP TRIGGER IF EXISTS trg_orders_update_customer_metrics ON public.orders;
CREATE TRIGGER trg_orders_update_customer_metrics
    AFTER INSERT OR UPDATE OF status, final_total, customer_id OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_customer_order_metrics();


-- ============================================================================
-- 4. STORED PROCEDURES & ATOMIC FUNCTIONS
-- ============================================================================

-- 4.1 Concurrency-safe atomic inventory stock adjustment -----------------------
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

-- 4.2 Atomic order creation ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_id TEXT,
    p_restaurant_id TEXT,
    p_customer_id TEXT,
    p_payment_method TEXT,
    p_payment_amount NUMERIC,
    p_change_amount NUMERIC,
    p_comment TEXT,
    p_items JSONB,
    p_delivery_fee NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rest RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_add RECORD;
    v_prod_add RECORD;
    v_qty INTEGER;
    v_add_qty INTEGER;
    v_calculated_subtotal NUMERIC(12, 2) := 0.00;
    v_final_total NUMERIC(12, 2);
    v_created_order RECORD;
BEGIN
    -- 1. Validar estructura básica de items
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Validar que el restaurante exista y esté ACTIVO
    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_rest.is_active THEN
        RAISE EXCEPTION 'Restaurant % is inactive', v_rest.name USING ERRCODE = 'P0001';
    END IF;

    -- 2b. Validate the client-provided delivery fee when present: it is
    -- computed by the use case and must never be negative (a negative fee
    -- would let cash below the real total pass the step-8 validation).
    IF p_delivery_fee IS NOT NULL AND p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee: %', p_delivery_fee USING ERRCODE = 'P0001';
    END IF;

    -- 3. Validar customer_id si fue provisto
    IF p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
        IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND restaurant_id = p_restaurant_id) THEN
            RAISE EXCEPTION 'Customer % does not belong to restaurant %', p_customer_id, p_restaurant_id USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 4. Crear cabecera temporal de la orden con subtotal 0 (se actualiza al final del loop)
    INSERT INTO public.orders (
        id, restaurant_id, customer_id, status, subtotal,
        delivery_fee, final_total, payment_method, payment_amount,
        change_amount, comment, created_at, updated_at
    ) VALUES (
        p_order_id,
        p_restaurant_id,
        NULLIF(p_customer_id, ''),
        'pending',
        0.00,
        COALESCE(p_delivery_fee, v_rest.delivery_fee),
        COALESCE(p_delivery_fee, v_rest.delivery_fee),
        COALESCE(p_payment_method, 'Efectivo'),
        p_payment_amount,
        p_change_amount,
        NULLIF(p_comment, ''),
        NOW(),
        NOW()
    );

    -- 5. Iterar sobre los items consultando el precio REAL en la tabla 'products'
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item.value->>'quantity')::integer;
        IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 100 THEN
            RAISE EXCEPTION 'Invalid item quantity: %', v_qty USING ERRCODE = 'P0001';
        END IF;

        SELECT * INTO v_prod FROM public.products
        WHERE id = v_item.value->>'product_id' AND restaurant_id = p_restaurant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not belong to restaurant % or does not exist', v_item.value->>'product_id', p_restaurant_id USING ERRCODE = 'P0002';
        END IF;
        IF NOT v_prod.is_available THEN
            RAISE EXCEPTION 'Product % is not available', v_prod.name USING ERRCODE = 'P0001';
        END IF;

        -- Insertar order_item con el unit_price oficial de la BD
        INSERT INTO public.order_items (
            id, order_id, restaurant_id, product_id, product_name, unit_price, quantity, observation
        ) VALUES (
            v_item.value->>'id',
            p_order_id,
            p_restaurant_id,
            v_prod.id,
            v_prod.name,
            v_prod.price,
            v_qty,
            NULLIF(v_item.value->>'observation', '')
        );

        v_calculated_subtotal := v_calculated_subtotal + (v_prod.price * v_qty);

        -- 6. Iterar sobre las adiciones consultando el precio REAL en 'product_additions'
        IF v_item.value ? 'additions' AND jsonb_array_length(v_item.value->'additions') > 0 THEN
            FOR v_add IN SELECT * FROM jsonb_array_elements(v_item.value->'additions')
            LOOP
                v_add_qty := COALESCE((v_add.value->>'quantity')::integer, 1);
                IF v_add_qty <= 0 OR v_add_qty > 10 THEN
                    RAISE EXCEPTION 'Invalid addition quantity: %', v_add_qty USING ERRCODE = 'P0001';
                END IF;

                SELECT * INTO v_prod_add FROM public.product_additions
                WHERE id = v_add.value->>'addition_id' AND restaurant_id = p_restaurant_id;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Addition % does not belong to restaurant %', v_add.value->>'addition_id', p_restaurant_id USING ERRCODE = 'P0002';
                END IF;
                IF v_prod_add.product_id IS NOT NULL AND v_prod_add.product_id <> v_prod.id THEN
                    RAISE EXCEPTION 'Addition % does not apply to product %', v_prod_add.name, v_prod.name USING ERRCODE = 'P0001';
                END IF;
                IF NOT v_prod_add.is_available THEN
                    RAISE EXCEPTION 'Addition % is not available', v_prod_add.name USING ERRCODE = 'P0001';
                END IF;

                -- Insertar order_item_addition con unit_price oficial
                INSERT INTO public.order_item_additions (
                    id, order_item_id, restaurant_id, addition_id, addition_name, unit_price, quantity
                ) VALUES (
                    v_add.value->>'id',
                    v_item.value->>'id',
                    p_restaurant_id,
                    v_prod_add.id,
                    v_prod_add.name,
                    v_prod_add.price,
                    v_add_qty
                );

                v_calculated_subtotal := v_calculated_subtotal + (v_prod_add.price * v_add_qty * v_qty);
            END LOOP;
        END IF;
    END LOOP;

    -- 7. Validar monto mínimo de compra
    IF v_rest.min_order_amount > 0 AND v_calculated_subtotal < v_rest.min_order_amount THEN
        RAISE EXCEPTION 'Subtotal % is below minimum order amount %', v_calculated_subtotal, v_rest.min_order_amount USING ERRCODE = 'P0001';
    END IF;

    -- 8. Validar efectivo vs monto pagado si aplica (fee provided by the
    -- use case is authoritative; restaurant fee is only the SQL fallback)
    v_final_total := v_calculated_subtotal + COALESCE(p_delivery_fee, v_rest.delivery_fee);
    IF p_payment_method = 'Efectivo' AND p_payment_amount IS NOT NULL THEN
        IF p_payment_amount < v_final_total THEN
            RAISE EXCEPTION 'Payment amount % is less than final total %', p_payment_amount, v_final_total USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 9. Actualizar totales calculados oficialmente
    UPDATE public.orders
    SET subtotal = v_calculated_subtotal, final_total = v_final_total
    WHERE id = p_order_id
    RETURNING * INTO v_created_order;

    RETURN to_jsonb(v_created_order);
END;
$$;

-- 4.3 Atomic order status update with actor audit ------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status_with_actor(
    p_order_id TEXT,
    p_new_status TEXT,
    p_restaurant_id TEXT,
    p_actor TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    -- Validar actor si fue provisto
    IF p_actor IS NOT NULL AND p_actor <> '' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor AND (restaurant_id = p_restaurant_id OR role = 'super_admin')
        ) THEN
            RAISE EXCEPTION 'Actor % is not authorized for restaurant %', p_actor, p_restaurant_id USING ERRCODE = 'P0001';
        END IF;
        PERFORM set_config('app.actor', p_actor, true);
    END IF;

    -- Actualizar status aislando estrictamente por id Y restaurant_id
    UPDATE public.orders
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_order_id AND restaurant_id = p_restaurant_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected > 0;
END;
$$;


-- ============================================================================
-- 5. PERFORMANCE INDEXES (Multi-Tenancy & Query Patterns)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_username            ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id       ON public.users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant     ON public.categories(restaurant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_cat   ON public.products(restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_available        ON public.products(restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_additions_restaurant_prod ON public.product_additions(restaurant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_rest_phone      ON public.customers(restaurant_id, phone);
CREATE INDEX IF NOT EXISTS idx_orders_rest_created       ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rest_status        ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer           ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id      ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id    ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant    ON public.order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_item ON public.order_item_additions(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_addition ON public.order_item_additions(addition_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_restaurant ON public.order_item_additions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_restaurant ON public.order_status_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_rest     ON public.restaurant_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant      ON public.suppliers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant ON public.inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock  ON public.inventory_items(restaurant_id, current_stock);


-- ============================================================================
-- 6. PERMISSIONS & ROLE CONFIGURATION
-- ============================================================================
GRANT USAGE ON SCHEMA public TO app_user;
-- Per-table grants instead of GRANT ... ON ALL TABLES: keeps each grant
-- statement's lock footprint to one table (see the lock discipline note
-- under section 7).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_hours TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_additions TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_additions TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_order_counters TO app_user;
COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_user;
COMMIT;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO app_user;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC) TO app_user;
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) TO app_user;


-- ============================================================================
-- 7. ROW LEVEL SECURITY (Multi-Tenant Isolation & Storefront Access)
--
-- Lock discipline: DROP/CREATE POLICY and ALTER TABLE ... ROW LEVEL SECURITY
-- take ACCESS EXCLUSIVE table locks. The integration suite re-applies this
-- whole file through a single multi-statement driver query while other test
-- files run DML; server logs proved that in that transport the intermediate
-- COMMITs below are no-ops ("there is no transaction in progress") and do
-- NOT partition the implicit batch transaction — the reapply can hold two
-- tables' ACE locks at once and deadlock against concurrent INSERTs doing
-- foreign-key pre-checks (RowShare on child + parent tables). The real guard
-- lives in the runner: run-postgres-tests.ts executes the postgres suites
-- serially (--fileParallelism=false), so the reapply never overlaps
-- in-flight DML. The COMMITs are kept because they are harmless no-ops in
-- per-statement autocommit contexts (psql -f, docker-entrypoint initdb, the
-- CI schema step).
-- ============================================================================
ALTER TABLE public.restaurants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants               FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.restaurant_hours          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_hours          FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.categories                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories                FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                  FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.product_additions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions         FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.customers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers                 FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                    FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.order_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items               FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.order_item_additions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions      FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.order_status_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history      FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.suppliers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.inventory_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items           FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.restaurant_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters FORCE ROW LEVEL SECURITY;
COMMIT;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     FORCE ROW LEVEL SECURITY;
COMMIT;

-- 7.1 Public Read Policies (Storefront Menu & Restaurant Discovery)
DROP POLICY IF EXISTS "public_read_active_restaurants" ON public.restaurants;
CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    USING (is_active = TRUE);

COMMIT;
DROP POLICY IF EXISTS "public_read_restaurant_hours" ON public.restaurant_hours;
CREATE POLICY "public_read_restaurant_hours"
    ON public.restaurant_hours FOR SELECT
    USING (TRUE);

COMMIT;
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    USING (is_active = TRUE);

COMMIT;
DROP POLICY IF EXISTS "public_read_available_products" ON public.products;
CREATE POLICY "public_read_available_products"
    ON public.products FOR SELECT
    USING (is_available = TRUE);

COMMIT;
DROP POLICY IF EXISTS "public_read_available_additions" ON public.product_additions;
CREATE POLICY "public_read_available_additions"
    ON public.product_additions FOR SELECT
    USING (is_available = TRUE);

-- 7.2 Multi-Tenant Write & Admin Policies (Optimized with InitPlan caching)
COMMIT;
    -- Users auth policy: scoped reads.
    --  - Tenant sessions see only their own restaurant's users.
    --  - Super-admin context sees all users.
    --  - A session with NO tenant context (empty app.restaurant_id AND empty
    --    app.actor_role GUCs) sees NOTHING directly. The old third OR branch
    --    (both GUCs NULL -> USING (TRUE)) made any no-context session — e.g.
    --    the anon role on a Supabase-hosted DB, which keeps default table
    --    grants and never sets these GUCs — able to dump the whole table
    --    including password_hash (JD-CRIT-03). Login bootstrap must resolve
    --    a user by credential BEFORE restaurantId is known; that path is the
    --    narrow SECURITY DEFINER escape hatch below, never a full-table read.
    DROP POLICY IF EXISTS "users_select_for_auth" ON public.users;
    CREATE POLICY "users_select_for_auth" ON public.users
        FOR SELECT
        USING (
            ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
            OR (
                (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), '')) IS NOT NULL
                AND restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
            )
        );
    
    -- Auth bootstrap escape hatches (JD-CRIT-03): RLS now denies every
    -- direct no-context read of public.users, but the login path must still
    -- resolve the single user matching the login credential before any tenant
    -- context exists. These SECURITY DEFINER functions are the ONLY
    -- no-context readers: they search by exact match on one credential only
    -- (never a scan), return at most the single matching row with every
    -- column the authenticator needs (password_hash is included solely for
    -- password verification), and run as the owning superuser with a
    -- hardened search_path so RLS never applies inside them and no
    -- search_path object can be injected. Every other read of public.users
    -- must go through RLS with an explicit tenant context.
    CREATE OR REPLACE FUNCTION public.look_up_user_for_auth(p_username TEXT)
    RETURNS SETOF public.users
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
    BEGIN
        RETURN QUERY
        SELECT *
        FROM public.users
        WHERE username = p_username
        LIMIT 1;
    END;
    $$;

    -- By-id variant for the repository's findById: users.id is TEXT (like
    -- every id in this schema), so a second overload of look_up_user_for_auth
    -- would collide with the TEXT username signature — hence the distinct name.
    CREATE OR REPLACE FUNCTION public.look_up_user_for_auth_by_id(p_user_id TEXT)
    RETURNS SETOF public.users
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
    BEGIN
        RETURN QUERY
        SELECT *
        FROM public.users
        WHERE id = p_user_id
        LIMIT 1;
    END;
    $$;

    -- Least privilege on the escape hatches: drop the default PUBLIC
    -- EXECUTE grant (Postgres grants EXECUTE to PUBLIC on every new
    -- function; on a Supabase-hosted DB that would let the anon key call
    -- the lookup via PostgREST RPC and read password hashes by username,
    -- recreating the JD-CRIT-03 leak through a narrower hole).
    REVOKE EXECUTE ON FUNCTION public.look_up_user_for_auth(TEXT) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.look_up_user_for_auth_by_id(TEXT) FROM PUBLIC;
    -- The app_user connection pool is the only consumer of the auth path.
    GRANT EXECUTE ON FUNCTION public.look_up_user_for_auth(TEXT) TO app_user;
    GRANT EXECUTE ON FUNCTION public.look_up_user_for_auth_by_id(TEXT) TO app_user;
    -- Supabase-managed databases also ship a service_role role (the backend's
    -- supabase-js client can run with the service-role key); grant it there
    -- too, guarded so it is a no-op on vanilla PostgreSQL (docker-compose,
    -- CI service containers) where that role does not exist.
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            EXECUTE 'GRANT EXECUTE ON FUNCTION public.look_up_user_for_auth(TEXT) TO service_role';
            EXECUTE 'GRANT EXECUTE ON FUNCTION public.look_up_user_for_auth_by_id(TEXT) TO service_role';
        END IF;
    END;
    $$;
    
    -- Platform rows (restaurant_id IS NULL) are reserved for super_admin: a
    -- tenant session may only create its own restaurant_admin staff and can
    -- never mint a platform-level account.
    DROP POLICY IF EXISTS "tenant_isolation_users_write" ON public.users;
    CREATE POLICY "tenant_isolation_users_write" ON public.users
        FOR INSERT
        WITH CHECK (
            ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
            OR (
                restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
                AND role <> 'super_admin'::text
            )
        );
    
    -- Tenant sessions may update only their own rows and may never escalate:
    -- role and restaurant_id must stay unchanged (password_hash changes for
    -- own staff remain allowed).
        -- Tenant sessions may update only their own rows. RLS policies cannot
        -- compare NEW vs OLD rows (PostgreSQL rejects NEW/OLD in policy
        -- expressions), so role/restaurant escalation is blocked by the
        -- BEFORE UPDATE trigger guard_users_privilege_change below.
        DROP POLICY IF EXISTS "tenant_isolation_users_update" ON public.users;
        -- Fail-closed updates: USING (TRUE) reveals rows so that disallowed
        -- writes raise 42501 via WITH CHECK instead of silently updating 0
        -- rows. A tenant session can never touch platform rows
        -- (restaurant_id IS NULL) or other tenants' rows, and can never mint
        -- or escalate a row to super_admin; the BEFORE UPDATE trigger below
        -- remains the backstop for role/restaurant changes.
        CREATE POLICY "tenant_isolation_users_update" ON public.users
            FOR UPDATE
            USING (TRUE)
            WITH CHECK (
                ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
                OR (
                    restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))
                    AND role <> 'super_admin'::text
                )
            );
        
        -- Privilege-change backstop: RLS cannot compare OLD vs NEW, so this
        -- BEFORE UPDATE trigger is the only DB-level way to stop a tenant
        -- session from escalating a user's role or moving a user between
        -- tenants (self-promotion / cross-tenant takeover).
        CREATE OR REPLACE FUNCTION public.guard_users_privilege_change()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = public, pg_temp
        AS $$
        BEGIN
            IF NEW.role IS DISTINCT FROM OLD.role
               OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id THEN
                IF (SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) IS DISTINCT FROM 'super_admin'::text THEN
                    RAISE EXCEPTION USING ERRCODE = '42501',
                        MESSAGE = 'Only super_admin may change a user''s role or restaurant';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;
        
        DROP TRIGGER IF EXISTS trg_users_guard_privilege_change ON public.users;
        CREATE TRIGGER trg_users_guard_privilege_change
            BEFORE UPDATE ON public.users
            FOR EACH ROW EXECUTE FUNCTION public.guard_users_privilege_change();
        
    DROP POLICY IF EXISTS "tenant_isolation_users_delete" ON public.users;
    CREATE POLICY "tenant_isolation_users_delete" ON public.users
        FOR DELETE
        USING (
            ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text)
            OR (restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), '')))
        );
    
COMMIT;
-- Restaurants write isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurants_write" ON public.restaurants;
CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING ((id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Restaurant Hours isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Categories isolation
DROP POLICY IF EXISTS "tenant_isolation_categories_select" ON public.categories;
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_write" ON public.categories;
CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_update" ON public.categories;
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_delete" ON public.categories;
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Products isolation
DROP POLICY IF EXISTS "tenant_isolation_products_select" ON public.products;
CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_write" ON public.products;
CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_update" ON public.products;
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_delete" ON public.products;
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Product Additions isolation
DROP POLICY IF EXISTS "tenant_isolation_product_additions_select" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_write" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_update" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_delete" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Customers isolation
DROP POLICY IF EXISTS "tenant_isolation_customers" ON public.customers;
CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Orders isolation
DROP POLICY IF EXISTS "tenant_isolation_orders" ON public.orders;
CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Order Items isolation
DROP POLICY IF EXISTS "tenant_isolation_order_items" ON public.order_items;
CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Order Item Additions isolation
DROP POLICY IF EXISTS "tenant_isolation_order_item_additions" ON public.order_item_additions;
CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Order Status History isolation
DROP POLICY IF EXISTS "tenant_isolation_order_status_history" ON public.order_status_history;
CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Restaurant Order Counters isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters;
CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Suppliers isolation
DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

COMMIT;
-- Inventory Items isolation
DROP POLICY IF EXISTS "tenant_isolation_inventory_items" ON public.inventory_items;
CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));
