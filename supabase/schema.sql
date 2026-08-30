-- ============================================================================
-- BURGER-PAGE — Pure Relational Schema (Postgres-Portable, Supabase-Compatible)
-- File: schema.sql
-- Description: Fully normalized relational DDL with ZERO unstructured JSONB
--              blobs. Written for a setup where a SINGLE trusted backend
--              (Fastify, hexagonal architecture) is the only thing that talks
--              to Postgres — the frontend never connects directly. Because of
--              that, tenant isolation is NOT done with Postgres roles/RLS per
--              tenant (that pattern is for when browsers connect straight to
--              Supabase). Instead, isolation is enforced in your backend's
--              infrastructure/adapter layer — see the notes at the bottom.
--
--              Runs unmodified on Supabase, RDS, Cloud SQL, or a plain
--              `postgres:16` Docker container — nothing here is Supabase-only.
--              The optional image bucket lives in a separate file:
--              supabase_storage_extension.sql (Supabase-only, skip if you
--              store images elsewhere, e.g. S3/R2, from your backend).
--
-- Run: Execute once on a fresh database.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
-- pgcrypto ships with core Postgres contrib and provides gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- 1. UTILITY FUNCTIONS & AUTOMATIONS
-- ============================================================================
-- SET search_path pins name resolution so the function can't be hijacked by
-- a manipulated search_path at call time — cheap, standard hardening.
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

-- 2.1.1 RESTAURANT HOURS (per day of week — replaces a single fixed
--        open_time/close_time when a restaurant needs different hours per
--        day, e.g. closed Sundays). open_time/close_time on restaurants
--        stays as a simple fallback/display default.
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

-- 2.6.1 RESTAURANT ORDER COUNTERS --------------------------------------------
-- Backs a race-condition-free per-restaurant order_number sequence (see
-- trigger below). One row per restaurant, updated with a row lock instead
-- of app-side MAX(order_number)+1, which is unsafe under concurrent inserts.
CREATE TABLE public.restaurant_order_counters (
    restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    last_number   INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- 2.7 ORDERS (Sales Header / POS) --------------------------------------------
CREATE TABLE public.orders (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_number    INTEGER, -- auto-assigned by trigger if left NULL, see below
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
-- Auto-populated audit trail — who/when an order moved between statuses.
-- changed_by is nullable TEXT (not an FK) so it survives even if the acting
-- user is later deleted, and so it can hold 'system' for automated changes.
-- Your backend can set it per-request with:
--   SET LOCAL app.actor = 'user_id_or_system';
-- (optional — defaults to NULL if never set, see function below).
CREATE TABLE public.order_status_history (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id    TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    old_status  TEXT,
    new_status  TEXT NOT NULL,
    changed_by  TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
-- subtotal is a GENERATED column: it's mathematically impossible for it to
-- drift from unit_price * quantity, so don't pass it on INSERT.
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
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 INVENTORY (Raw Materials, Ingredients, Supplies) ----------------------
CREATE TABLE public.inventory (
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
    CONSTRAINT uq_inventory_restaurant_name
        UNIQUE (restaurant_id, name)
);


-- ============================================================================
-- 3. TRIGGERS (Automate updated_at + order_number + status history)
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

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3.1 Concurrency-safe per-restaurant order_number ---------------------------
-- Locks (or creates) the counter row for this restaurant, increments it, and
-- assigns it to NEW.order_number if the caller didn't supply one. Safe under
-- concurrent inserts because UPDATE ... RETURNING takes a row lock.
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
-- changed_by picks up `app.actor` if your backend sets it with
-- `SET LOCAL app.actor = '<user_id>'` before the UPDATE; otherwise NULL.
-- This is entirely optional — the trigger works fine if you never set it.
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

-- 3.3 Transactional Order Creation (Atomic, authoritative prices, pure Postgres)
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_id TEXT,
    p_restaurant_id TEXT,
    p_customer_id TEXT,
    p_payment_method TEXT,
    p_payment_amount NUMERIC,
    p_change_amount NUMERIC,
    p_comment TEXT,
    p_items JSONB
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
        v_rest.delivery_fee,
        v_rest.delivery_fee,
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

        -- Insertar order_item con el unit_price oficial de la BD (subtotal es GENERATED)
        INSERT INTO public.order_items (
            id, order_id, product_id, product_name, unit_price, quantity, observation
        ) VALUES (
            v_item.value->>'id',
            p_order_id,
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

                -- Insertar order_item_addition con unit_price oficial (total es GENERATED)
                INSERT INTO public.order_item_additions (
                    id, order_item_id, addition_id, addition_name, unit_price, quantity
                ) VALUES (
                    v_add.value->>'id',
                    v_item.value->>'id',
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

    -- 8. Validar efectivo vs monto pagado si aplica
    v_final_total := v_calculated_subtotal + v_rest.delivery_fee;
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

-- 3.4 Actualizar Estado de Orden con Registro de Actor Seguro
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

-- Permisos explícitos de ejecución (Principio de Menor Privilegio)
REVOKE ALL ON FUNCTION public.create_order_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_order_status_with_actor FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor TO service_role, authenticated;


-- ============================================================================
-- 4. PERFORMANCE INDEXES (Multi-Tenancy & Join-Heavy Query Patterns)
-- ============================================================================
-- Users
CREATE INDEX idx_users_username            ON public.users(username);
CREATE INDEX idx_users_restaurant_id       ON public.users(restaurant_id);
-- Categories
CREATE INDEX idx_categories_restaurant     ON public.categories(restaurant_id, display_order);
-- Products
CREATE INDEX idx_products_restaurant_cat   ON public.products(restaurant_id, category_id);
CREATE INDEX idx_products_available        ON public.products(restaurant_id, is_available);
-- Product Additions
CREATE INDEX idx_additions_restaurant_prod ON public.product_additions(restaurant_id, product_id);
-- Customers
CREATE INDEX idx_customers_rest_phone      ON public.customers(restaurant_id, phone);
-- Orders
CREATE INDEX idx_orders_rest_created       ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX idx_orders_rest_status        ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_customer           ON public.orders(customer_id);
-- Order Items & Line Additions
CREATE INDEX idx_order_items_order_id      ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id    ON public.order_items(product_id);
CREATE INDEX idx_order_item_additions_item ON public.order_item_additions(order_item_id);
-- Order status history
CREATE INDEX idx_order_status_history_order ON public.order_status_history(order_id, changed_at DESC);
-- Restaurant hours
CREATE INDEX idx_restaurant_hours_rest     ON public.restaurant_hours(restaurant_id);
-- Suppliers & Inventory
CREATE INDEX idx_suppliers_restaurant      ON public.suppliers(restaurant_id);
CREATE INDEX idx_inventory_restaurant      ON public.inventory(restaurant_id);
CREATE INDEX idx_inventory_low_stock       ON public.inventory(restaurant_id, current_stock);


-- ============================================================================
-- 5. ROW LEVEL SECURITY — public storefront read-only policies ONLY
-- ============================================================================
-- Since your Fastify backend is the only thing that talks to Postgres (using
-- a single trusted connection, e.g. Supabase's `service_role` or a plain
-- Postgres superuser/app user), full per-tenant RLS policies would be dead
-- weight — that connection already bypasses or satisfies every policy you'd
-- write, so they'd add complexity without adding real protection.
--
-- We still enable RLS + add narrow read-only policies for `anon` on the
-- storefront-facing tables. This is a pure safety net: it only matters if a
-- Supabase anon/public key ever leaks into a client bundle or gets used
-- somewhere unintended — with these policies in place, that key could only
-- ever read active/available public data, never write, and never touch
-- customers/orders/inventory. If your frontend NEVER holds any Supabase key
-- at all (it only calls your Fastify API), you can skip this section
-- entirely — but it's cheap insurance to leave in.
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

-- Tables with no public read use case (users, customers, orders, order
-- items/additions, order_status_history, suppliers, inventory,
-- restaurant_order_counters) intentionally have NO policies at all — RLS
-- is not even enabled on them, so only your backend's trusted connection
-- (which should never be `anon`) can touch them, same as before.


-- ============================================================================
-- 6. NOTES / NEXT STEPS — where tenant isolation actually lives for you
-- ============================================================================
-- Your backend is a single trusted connection, so `restaurant_id` scoping
-- has to be enforced in CODE, in the infrastructure/adapter layer, not in
-- Postgres. Two concrete rules for your hexagonal backend:
--
-- 1. Every use case that reads or writes tenant data (ListProducts,
--    CreateOrder, UpdateInventory, etc.) must receive `restaurant_id` from
--    the AUTHENTICATED SESSION/JWT of the caller — never from the request
--    body/query params. If a restaurant_admin's JWT says restaurant_id=42,
--    the use case ignores any restaurant_id the client tries to pass and
--    always uses 42.
--
-- 2. Every adapter query that touches a tenant-scoped table MUST include
--    `WHERE restaurant_id = $1` — including UPDATE and DELETE, not just
--    SELECT. A common bug is scoping SELECT/list endpoints correctly but
--    forgetting the WHERE clause on an UPDATE-by-id or DELETE-by-id route,
--    which lets one tenant mutate another tenant's row if they guess/enum-
--    erate an id. A quick way to audit this: grep your adapters for
--    `WHERE id = $` and confirm restaurant_id is ALSO in the WHERE clause
--    (or that the row was already loaded through a restaurant_id-scoped
--    query first).
--
-- 3. super_admin routes are the one place that legitimately skip the
--    restaurant_id filter — keep those behind a distinct middleware/guard
--    so it's obvious in the code which endpoints are cross-tenant.
--
-- • Image/file storage: no storage.buckets section here — that's Supabase
--   product API, not core Postgres. If you're still on Supabase, see
--   supabase_storage_extension.sql. Otherwise point logo_url/banner_url/
--   image_url at S3/R2/MinIO uploaded via your backend.
-- • Consider a `staff`/`cashier`/`kitchen` tier on users.role as permission
--   needs grow beyond super_admin/restaurant_admin.
-- • Consider an `addition_groups` table (min_select/max_select/required) if
--   you need "choose 1 of 3 sauces" style modifier rules later.