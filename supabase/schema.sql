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
-- 0. EXTENSIONS & ROLES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Stub Supabase-specific roles if running on standard PostgreSQL (Docker, CI, self-hosted)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
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
-- restaurant_id está denormalizado desde orders.restaurant_id (poblado por el
-- trigger log_order_status_change vía NEW.restaurant_id) para que las políticas
-- RLS de esta tabla no necesiten un join contra 'orders' en cada chequeo.
CREATE TABLE public.order_status_history (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    old_status    TEXT,
    new_status    TEXT NOT NULL,
    changed_by    TEXT,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
-- restaurant_id denormalizado desde orders.restaurant_id (poblado por
-- create_order_atomic vía p_restaurant_id) — mismo motivo que arriba.
CREATE TABLE public.order_items (
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
-- restaurant_id denormalizado desde orders.restaurant_id (poblado por
-- create_order_atomic vía p_restaurant_id) — mismo motivo que arriba.
CREATE TABLE public.order_item_additions (
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
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NEW.restaurant_id, NULL, NEW.status, NULLIF(current_setting('app.actor', true), ''));
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by)
        VALUES (NEW.id, NEW.restaurant_id, OLD.status, NEW.status, NULLIF(current_setting('app.actor', true), ''));
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

-- 3.4 Atomic order creation ----------------------------------------------------
-- Reconciliado desde el estado real de producción (no versionado desde el
-- commit 933024d, que las quitó de este archivo sin actualizar el backend, que
-- las sigue invocando vía SupabaseOrderRepository.ts). p_restaurant_id se
-- propaga a order_items/order_item_additions para la denormalización de
-- restaurant_id (sección 2.7.1/2.8/2.9).
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

                -- Insertar order_item_addition con unit_price oficial (total es GENERATED)
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

REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO postgres;

-- 3.5 Atomic order status update with actor audit ------------------------------
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

REVOKE ALL ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) TO postgres;


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
CREATE INDEX idx_order_items_restaurant    ON public.order_items(restaurant_id);
CREATE INDEX idx_order_item_additions_item ON public.order_item_additions(order_item_id);
CREATE INDEX idx_order_item_additions_addition ON public.order_item_additions(addition_id);
CREATE INDEX idx_order_item_additions_restaurant ON public.order_item_additions(restaurant_id);
CREATE INDEX idx_order_status_history_order ON public.order_status_history(order_id, changed_at DESC);
CREATE INDEX idx_order_status_history_restaurant ON public.order_status_history(restaurant_id);
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


-- ============================================================================
-- 6. APP TENANT ROLE + WRITE RLS (Real Multi-Tenant Isolation)
-- ============================================================================
-- Rol de Postgres sin BYPASSRLS que el backend usa vía 'pg' (conexión cruda,
-- no PostgREST/supabase-js) para las 14 tablas de negocio, fijando dos GUCs
-- de sesión por transacción con SET LOCAL (mismo patrón que 'app.actor'):
--   - app.restaurant_id: tenant activo de la operación
--   - app.actor_role:    'super_admin' | 'restaurant_admin' (permite
--                         operaciones legítimas cross-tenant de super-admin)
-- 100% Postgres estándar — sin auth.uid()/auth.jwt() de Supabase — sobrevive
-- intacta una futura migración fuera de Supabase.
--
-- IMPORTANTE: este archivo no fija el password de app_user. En local (Docker)
-- se fija en docker-compose.yml o a mano tras el bootstrap; en producción se
-- fija una única vez fuera de git, vía secret manager.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.restaurants,
    public.restaurant_hours,
    public.users,
    public.categories,
    public.products,
    public.product_additions,
    public.customers,
    public.restaurant_order_counters,
    public.orders,
    public.order_status_history,
    public.order_items,
    public.order_item_additions,
    public.suppliers,
    public.inventory_items
TO app_user;

ALTER TABLE public.customers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING (id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- users: caso especial — findByUsername (login) necesita resolver el usuario
-- ANTES de conocer restaurant_id. app_user nunca se expone a clientes
-- externos (vive solo en el backend, mismo modelo de confianza que hoy tiene
-- service_role), así que un SELECT sin scoping es aceptable; la escritura sí
-- queda scoped al tenant (o a super_admin).
CREATE POLICY "users_select_for_auth" ON public.users
    FOR SELECT
    USING (true);

CREATE POLICY "tenant_isolation_users_write" ON public.users
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_users_update" ON public.users
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_users_delete" ON public.users
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- 6.1 Catálogo (categories, products, product_additions, restaurant_hours):
-- ya tenían RLS habilitado con solo lectura pública (sección 5) — se les
-- agrega escritura tenant-scoped con el mismo predicado.
ALTER TABLE public.categories        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_hours  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');
CREATE POLICY "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- 6.1.1 Postgres exige, además del WITH CHECK de UPDATE, que la fila (vieja y
-- nueva) sea visible bajo alguna política de SELECT permisiva. Sin esto, un
-- UPDATE que apaga is_active/is_available queda imposible (verificado
-- empíricamente: "new row violates row-level security policy") porque la
-- única política de SELECT era la pública (is_active/is_available = TRUE).
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours
    FOR SELECT
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- 6.2 app_user reusa la lógica ya validada de estas 3 RPC SECURITY DEFINER
-- (cada una ya valida que las entidades referenciadas pertenezcan al
-- restaurant_id recibido) en vez de reimplementarla en TypeScript.
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO app_user;
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO app_user;
