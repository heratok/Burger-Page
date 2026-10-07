-- ============================================================================
-- BURGER-PAGE — Pure PostgreSQL Canonical Relational Schema
-- File: database/01_schema.sql
-- Description: Standard, vendor-neutral PostgreSQL DDL (Postgres 15+; the
--              composite tenant FKs use ON DELETE SET NULL (column_list)).
--              Designed for a trusted backend (Fastify, hexagonal architecture)
--              using standard 'pg' pool with multi-tenant isolation via
--              PostgreSQL Row Level Security (RLS) and session-level GUCs.
--
-- Compatibility: 100% standard PostgreSQL. Runs identically on:
--   - Local PostgreSQL (Docker, bare metal)
--   - Supabase (via SQL Editor or direct postgres connection)
--   - AWS RDS / Aurora / Neon / Render / Railway
--
-- Convención de idioma: identificadores en inglés (estándar de la industria,
-- decisión del equipo). Los comentarios y COMMENT ON están en español de
-- adrede: el idioma de los identificadores no afecta tooling y los comentarios
-- los lee el equipo. Los únicos valores en español no-técnicos son parte del
-- producto ('Efectivo', 'Transferencia', units 'unidades'...).
--
-- Buenas prácticas aplicadas (ver odd/tasks/bd-buenas-practicas.md):
--   - Sin extensión pgcrypto: gen_random_uuid() es núcleo desde PG 13.
--   - products.category_name ELIMINADO: desnormalización con drift; la
--     categoría se resuelve por category_id vía JOIN (repos PG/Supabase).
--   - COMMENT ON TABLE/COLUMN en español para discovery vía información_schema.
--   - Migraciones versionadas en database/migrations/ (node-pg-migrate).
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS & ROLES
-- ============================================================================
-- gen_random_uuid() es parte del núcleo de PostgreSQL desde la 13; la
-- extensión pgcrypto ya no se requiere.

-- Application role for the backend connection pool (without BYPASSRLS)
-- ADVERTENCIA: 'app_user_test_only' es SOLO para desarrollo/CI (volúmenes
-- tmpfs efímeros de docker-compose). En producción: ALTER ROLE app_user WITH
-- PASSWORD '...segura...'; ver database/README.md.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'app_user_test_only';
    END IF;
    -- An existing role is left untouched on purpose: re-applying this file must
    -- never reset a production password back to the dev/CI one.
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

-- RLS helper functions (db-hardening-0008): the tenant and the platform-admin
-- role of the session, read from the GUCs PgClient.withTenantContext sets with
-- SET LOCAL. Policies call them as (SELECT public.fn()) so the planner
-- evaluates each one once per query (InitPlan) instead of once per row.
-- STABLE is what makes that caching legal.
CREATE OR REPLACE FUNCTION public.app_current_restaurant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT NULLIF(current_setting('app.restaurant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.actor_role', true), '') = 'super_admin', FALSE);
$$;

-- Slug the storefront declares (PgClient.withTenantContext restaurantSlug) for
-- the one anonymous lookup that has no tenant yet: resolving a restaurant by its
-- public slug. Only the public read policies below look at it.
CREATE OR REPLACE FUNCTION public.app_current_restaurant_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT NULLIF(current_setting('app.restaurant_slug', true), '');
$$;


-- ============================================================================
-- 2. RELATIONAL TABLES
-- ============================================================================

-- 2.1 RESTAURANTS (Tenants — identidad) ----------------------------------
-- Solo identidad y ciclo de vida del tenant. La configuración operativa y la
-- identidad visual viven en tablas 1:1 separadas (3NF / cohesión):
--   restaurant_settings  → operación comercial (rompecabezas de delivery/orden)
--   restaurant_branding  → tema, marca y assets visuales
CREATE TABLE IF NOT EXISTS public.restaurants (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug                    TEXT UNIQUE NOT NULL,
    name                    TEXT NOT NULL,
    tagline                 TEXT,
    whatsapp_number         TEXT,
    address                 TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    deleted_slug            TEXT,
    CONSTRAINT chk_restaurants_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.restaurants IS 'Tenants: identidad y ciclo de vida del restaurante. Config/branding viven en restaurant_settings / restaurant_branding (1:1).';
COMMENT ON COLUMN public.restaurants.is_active IS 'Restaurante visible y operativo (usado por la política de lectura pública).';
COMMENT ON COLUMN public.restaurants.deleted_at IS 'Baja lógica del tenant (distinta de pausar con is_active=false): la app lo oculta de listados y búsquedas y renombra el slug para liberarlo.';
COMMENT ON COLUMN public.restaurants.deleted_slug IS 'Slug original del tenant al darlo de baja (el slug vigente se renombra con el sufijo -deleted-<id>). NULL mientras el tenant no esté dado de baja.';

-- 2.1.1 RESTAURANT SETTINGS (Configuración operativa 1:1) -------------------
-- Operación comercial del tenant: moneda, delivery, mínimos, horarios por
-- defecto y anuncios. El horario de atención vive en restaurant_opening_hours
-- (ÚNICA fuente, un rango por fila); timezone es la zona IANA en que se lee y
-- orders_paused el interruptor manual de pedidos. El texto "HH:MM - HH:MM" del
-- contrato HTTP se deriva del horario semanal y no se almacena aparte.
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    restaurant_id           TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    currency                TEXT NOT NULL DEFAULT 'COP',
    currency_symbol         TEXT NOT NULL DEFAULT '$',
    delivery_fee            NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    min_order_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
    estimated_delivery_time TEXT DEFAULT '30 - 45 min',
    timezone                TEXT NOT NULL DEFAULT 'America/Bogota',
    orders_paused           BOOLEAN NOT NULL DEFAULT FALSE,
    announcement_text       TEXT,
    show_announcement       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_restaurant_settings_timezone
        CHECK (timezone ~ '^[A-Za-z0-9_+/-]{1,64}$')
);

COMMENT ON TABLE public.restaurant_settings IS 'Configuración operativa 1:1 del restaurante (3NF: identidad ≠ configuración).';
COMMENT ON COLUMN public.restaurant_settings.delivery_fee IS 'Cargo de envío por defecto en la moneda del restaurante (>= 0).';
COMMENT ON COLUMN public.restaurant_settings.timezone IS 'Zona horaria IANA en la que se interpreta el horario de atención (restaurant_opening_hours).';
COMMENT ON COLUMN public.restaurant_settings.orders_paused IS 'Interruptor manual: true detiene los pedidos públicos aunque el horario esté abierto.';

-- 2.1.2 RESTAURANT BRANDING (Identidad visual 1:1) ---------------------------
-- Tema, marca y assets. Solo URLs (nunca binarios): los archivos viven en
-- storage de objetos (S3, Cloud Storage, etc.).
CREATE TABLE IF NOT EXISTS public.restaurant_branding (
    restaurant_id        TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    logo_url             TEXT,
    banner_url           TEXT,
    show_banner          BOOLEAN NOT NULL DEFAULT TRUE,
    primary_color        TEXT NOT NULL DEFAULT '#E63946',
    primary_hover_color  TEXT NOT NULL DEFAULT '#F25C69',
    bg_theme             TEXT NOT NULL DEFAULT 'dark-charcoal'
                            CHECK (bg_theme IN ('dark-charcoal', 'deep-midnight', 'warm-cream', 'clean-white')),
    font_family          TEXT NOT NULL DEFAULT 'sans'
                            CHECK (font_family IN ('sans', 'serif', 'mono', 'display')),
    card_radius          TEXT NOT NULL DEFAULT 'md'
                            CHECK (card_radius IN ('sm', 'md', 'lg', 'full')),
    card_style           TEXT NOT NULL DEFAULT 'elevated'
                            CHECK (card_style IN ('elevated', 'bordered', 'glass', 'minimal')),
    compact_grid         BOOLEAN NOT NULL DEFAULT FALSE,
    show_badges          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.restaurant_branding IS 'Identidad visual 1:1 del restaurante. URL de assets; tema, fuente, radios y estilos de UI.';
COMMENT ON COLUMN public.restaurant_branding.logo_url IS 'URL al storage de objetos (nunca binario en BD).';

-- 2.1.3 RESTAURANT OPENING HOURS (Horario semanal) ---------------------------
-- Un rango por fila; un día sin filas está cerrado y un día puede tener varios
-- rangos. close_time <= open_time cruza la medianoche (termina el día siguiente).
-- Es configuración, no historial: se borra en cascada con el restaurante.
CREATE TABLE IF NOT EXISTS public.restaurant_opening_hours (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time     TIME NOT NULL,
    close_time    TIME NOT NULL,
    CONSTRAINT chk_restaurant_opening_hours_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT uq_restaurant_opening_hours_range
        UNIQUE (restaurant_id, day_of_week, open_time)
);

COMMENT ON TABLE public.restaurant_opening_hours IS 'Horario de atención semanal: un rango por fila; sin filas el día está cerrado; close_time <= open_time cruza la medianoche.';
COMMENT ON COLUMN public.restaurant_opening_hours.day_of_week IS '0 = Domingo ... 6 = Sábado.';

-- 2.1.4 RESTAURANT TABLES (Mesas del salón) ----------------------------------
-- Mesas que el dueño administra y que una venta "Mesa / Salón" selecciona.
-- Configuración, no historial: se borra en cascada con el restaurante. El
-- nombre es único por restaurante sin distinguir mayúsculas (índice abajo).
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_restaurant_tables_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_restaurant_tables_name
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    CONSTRAINT uq_restaurant_tables_id_restaurant
        UNIQUE (id, restaurant_id)
);

COMMENT ON TABLE public.restaurant_tables IS 'Mesas del salón de un restaurante. Configuración: se borra en cascada con el restaurante; borrar una mesa no borra pedidos (orders.table_id pasa a NULL y table_label conserva el nombre).';
COMMENT ON COLUMN public.restaurant_tables.name IS 'Nombre visible (p. ej. "Mesa 4", "Terraza 2"); único por restaurante sin distinguir mayúsculas.';
COMMENT ON COLUMN public.restaurant_tables.sort_order IS 'Posición en la lista y en el selector de venta (menor primero).';
COMMENT ON COLUMN public.restaurant_tables.is_active IS 'false oculta la mesa del selector de venta sin borrar su historial.';

-- 2.1b ROLES (custom per-restaurant roles for staff users) ---------------------
-- A role is a named set of permissions chosen by the restaurant admin. The
-- permission catalog lives in code (packages/contracts); the application
-- validates every entry, so extending the catalog needs no migration.
CREATE TABLE IF NOT EXISTS public.roles (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    permissions   TEXT[] NOT NULL DEFAULT '{}',
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_roles_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_roles_name
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    CONSTRAINT chk_roles_permissions_no_nulls
        CHECK (array_position(permissions, NULL) IS NULL),
    CONSTRAINT uq_roles_id_restaurant
        UNIQUE (id, restaurant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_name
    ON public.roles (restaurant_id, lower(btrim(name)));

COMMENT ON TABLE public.roles IS 'Roles personalizados de un restaurante: conjunto de permisos (catálogo en código) que el admin asigna a usuarios restaurant_staff. Se borra en cascada con el restaurante; un rol en uso no se puede borrar.';
COMMENT ON COLUMN public.roles.name IS 'Nombre visible; único por restaurante sin distinguir mayúsculas.';
COMMENT ON COLUMN public.roles.permissions IS 'Permisos concedidos (p. ej. orders.view). El catálogo se valida en la aplicación.';
COMMENT ON COLUMN public.roles.is_system IS 'true = rol creado por el sistema; no editable ni borrable desde el panel.';

-- 2.2 USERS (Authentication & Role-Based Access Control) -----------------------
CREATE TABLE IF NOT EXISTS public.users (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL,
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    password_changed_at TIMESTAMPTZ,
    retired_was_active BOOLEAN,
    role_id       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_role
        CHECK (role IN ('super_admin', 'restaurant_admin', 'restaurant_staff')),
    CONSTRAINT chk_restaurant_admin_has_restaurant
        CHECK (role NOT IN ('restaurant_admin', 'restaurant_staff') OR restaurant_id IS NOT NULL),
    CONSTRAINT chk_users_role_id_matches_role
        CHECK ((role = 'restaurant_staff') = (role_id IS NOT NULL)),
    CONSTRAINT chk_users_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT fk_users_role_tenant
        FOREIGN KEY (role_id, restaurant_id)
        REFERENCES public.roles(id, restaurant_id)
        ON DELETE NO ACTION
);

COMMENT ON TABLE public.users IS 'Empleados/administradores. rol super_admin es de plataforma (restaurant_id NULL); restaurant_staff exige role_id.';
COMMENT ON COLUMN public.users.role_id IS 'Rol personalizado (roles) de un usuario restaurant_staff; NULL para super_admin y restaurant_admin. El rol debe ser del mismo restaurante y no se puede borrar mientras haya usuarios que lo usen.';
COMMENT ON COLUMN public.users.password_hash IS 'Hash con salt del credencial de acceso. Nunca se devuelve al frontend.';
COMMENT ON COLUMN public.users.must_change_password IS 'true tras un reseteo de contraseña por el super admin: el usuario solo puede cambiar su propia contraseña hasta hacerlo.';
COMMENT ON COLUMN public.users.password_changed_at IS 'Instante del último cambio/reseteo de contraseña. Los tokens emitidos antes (iat) se rechazan. NULL = nunca cambiada.';
COMMENT ON COLUMN public.users.retired_was_active IS 'is_active del usuario al darse de baja su restaurante; se usa para restaurarlo igual. NULL = no retirado o retirado antes de existir la columna (se restaura activo).';

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
        UNIQUE (restaurant_id, name),
    -- WU-1b (M2/M3): target del FK compuesto tenant-scoped de products.
    CONSTRAINT uq_categories_id_restaurant
        UNIQUE (id, restaurant_id),
    CONSTRAINT chk_categories_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.categories IS 'Secciones del menú por restaurante.';

-- 2.4 PRODUCTS (Menu Items) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id            TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id              TEXT,
    name                     TEXT NOT NULL,
    description              TEXT,
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
        UNIQUE (id, restaurant_id),
    -- WU-1b (M2/M3): la categoría referenciada debe pertenecer al mismo
    -- restaurante; SET NULL sigue anulando solo category_id al borrar la
    -- categoría (como hoy).
    CONSTRAINT fk_products_category_tenant
        FOREIGN KEY (category_id, restaurant_id)
        REFERENCES public.categories(id, restaurant_id)
        -- PG15+ column list: anula SOLO category_id al borrar la categoría
        -- (comportamiento previo); un SET NULL sin lista anularía también
        -- restaurant_id y fallaría por NOT NULL con productos existentes.
        ON DELETE SET NULL (category_id),
    CONSTRAINT chk_products_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.products IS 'Ítems del menú. La categoría se resuelve por category_id (JOIN a categories); nunca se duplica el nombre.';
COMMENT ON COLUMN public.products.price IS 'Precio oficial de venta (usado por create_order_atomic; nunca confiar en el cliente).';

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
    -- Schema integrity (0000000000007): target of the tenant-scoped FK from
    -- order_item_additions.
    CONSTRAINT uq_product_additions_id_restaurant
        UNIQUE (id, restaurant_id),
    CONSTRAINT fk_product_additions_product_restaurant
        FOREIGN KEY (product_id, restaurant_id)
        REFERENCES public.products(id, restaurant_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_product_additions_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.product_additions IS 'Extras/modificadores. product_id NULL = aplica a todo el restaurante.';

-- 2.6 CUSTOMERS (CRM) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    email           TEXT,
    address         TEXT,
    barrio          TEXT,
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
        UNIQUE (id, restaurant_id),
    CONSTRAINT chk_customers_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

-- db-hardening-0008: optional text (email, address, barrio) is NULL when absent,
-- not ''. The repositories map NULL back to '' for the domain.
COMMENT ON TABLE public.customers IS 'CRM. total_orders/total_spent/last_order_date son mantenidos por trigger en pedidos.';
COMMENT ON COLUMN public.customers.loyalty_tier IS 'Nivel de fidelidad (tokens estables de UI, no cambiar sin tocar frontend).';

-- 2.6.1 RESTAURANT ORDER COUNTERS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_order_counters (
    restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    last_number   INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

COMMENT ON TABLE public.restaurant_order_counters IS 'Contador atómico por restaurante para numerar pedidos concurrentemente.';

-- 2.7 ORDERS (Sales Header / POS) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    order_number    INTEGER, -- auto-assigned by trigger if left NULL
    customer_id     TEXT,
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
    client_order_id TEXT,
    -- WU-4 (4.3): snapshot de contacto capturado al crear/editar ESTE pedido.
    -- Nullable: los pedidos previos se rellenan desde customers en la migración
    -- 0000000000006 y la lectura hace COALESCE(snapshot, customers).
    contact_name    TEXT,
    contact_phone   TEXT,
    contact_address TEXT,
    contact_barrio  TEXT,
    -- Mesa de una venta "Mesa / Salón": table_id apunta a restaurant_tables
    -- (mismo restaurante, ver fk_orders_table_tenant); table_label es el
    -- snapshot del nombre y sobrevive a renombrar o borrar la mesa.
    table_id        TEXT,
    table_label     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- WU-1b (M2/M3): el customer referenciado debe pertenecer al mismo
    -- restaurante que la orden; SET NULL anula customer_id (columnas NULL
    -- del FK se saltan el chequeo, así las órdenes sin customer siguen OK).
    CONSTRAINT uq_orders_id_restaurant
        UNIQUE (id, restaurant_id),
    CONSTRAINT fk_orders_customer_tenant
        FOREIGN KEY (customer_id, restaurant_id)
        REFERENCES public.customers(id, restaurant_id)
        -- PG15+ column list: anula SOLO customer_id al borrar el customer
        -- (comportamiento previo); un SET NULL sin lista anularía también
        -- restaurant_id y fallaría por NOT NULL con órdenes existentes.
        ON DELETE SET NULL (customer_id),
    -- La mesa debe ser del mismo restaurante; borrar la mesa anula SOLO
    -- table_id (column list PG15+) y table_label conserva el nombre.
    CONSTRAINT fk_orders_table_tenant
        FOREIGN KEY (table_id, restaurant_id)
        REFERENCES public.restaurant_tables(id, restaurant_id)
        ON DELETE SET NULL (table_id),
    CONSTRAINT uq_orders_restaurant_order_number
        UNIQUE (restaurant_id, order_number),
    -- db-hardening-0008: the stored total is always subtotal + delivery_fee
    -- (create_order_atomic and PgOrderRepository.update both write it that way).
    CONSTRAINT chk_orders_final_total
        CHECK (final_total = subtotal + delivery_fee),
    CONSTRAINT chk_orders_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

-- db-hardening-0008: orders, order_items, order_item_additions and
-- order_status_history reference restaurants ON DELETE RESTRICT: deleting a
-- restaurant must never silently erase its sales and audit history. Hard delete
-- is an explicit operation that removes the orders first (see
-- PgRestaurantRepository.hardDelete); the app soft-deletes (is_active = false).
COMMENT ON TABLE public.orders IS 'Cabecera de venta. subtotal/total_final los calcula la BD (create_order_atomic).';
COMMENT ON COLUMN public.orders.status IS 'Estado del pedido. Valores = enum del contrato HTTP (no renombrar sin full-stack).';
COMMENT ON COLUMN public.orders.client_order_id IS 'Idempotencia SUS-19: correlación del cliente; único por (restaurant_id, client_order_id).';
COMMENT ON COLUMN public.orders.contact_name IS 'Snapshot del nombre de contacto dado en ESTE pedido (prevalece sobre customers.name al leer).';
COMMENT ON COLUMN public.orders.contact_phone IS 'Snapshot del teléfono de contacto dado en ESTE pedido.';
COMMENT ON COLUMN public.orders.contact_address IS 'Snapshot de la dirección de entrega dada en ESTE pedido.';
COMMENT ON COLUMN public.orders.contact_barrio IS 'Snapshot del barrio de entrega dado en ESTE pedido.';
COMMENT ON COLUMN public.orders.table_id IS 'Mesa donde se tomó la venta de salón (NULL si no aplica o si la mesa se borró).';
COMMENT ON COLUMN public.orders.table_label IS 'Snapshot del nombre de la mesa al vender: el historial lo conserva aunque la mesa se renombre o se borre.';

-- 2.7.1 ORDER STATUS HISTORY --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT NOT NULL,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    old_status    TEXT,
    new_status    TEXT NOT NULL,
    changed_by    TEXT,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- WU-1b (M2/M3): el histórico apunta a la orden del mismo restaurante.
    CONSTRAINT fk_order_status_history_order_tenant
        FOREIGN KEY (order_id, restaurant_id)
        REFERENCES public.orders(id, restaurant_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_order_status_history_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.order_status_history IS 'Auditoría append-only de transiciones de estado: solo la inserta el trigger de orders; app_user no puede actualizar ni borrar (el borrado de una orden la elimina en cascada).';

-- 2.8 ORDER ITEMS (Line Items — Fully Normalized) ----------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id      TEXT NOT NULL,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    product_id    TEXT,
    product_name  TEXT NOT NULL, -- historical snapshot at time of sale
    unit_price    NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    subtotal      NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    observation   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- WU-1b (M2/M3): la línea apunta a la orden del mismo restaurante;
    -- UNIQUE (id, restaurant_id) es el target del FK de las adiciones.
    CONSTRAINT uq_order_items_id_restaurant
        UNIQUE (id, restaurant_id),
    CONSTRAINT fk_order_items_order_tenant
        FOREIGN KEY (order_id, restaurant_id)
        REFERENCES public.orders(id, restaurant_id)
        ON DELETE CASCADE,
    -- Schema integrity (0000000000007): the sold product must belong to the
    -- same restaurant as the line. SET NULL (PG15+ column list) nulls only
    -- product_id when the product is deleted; the snapshot keeps the sale.
    CONSTRAINT fk_order_items_product_tenant
        FOREIGN KEY (product_id, restaurant_id)
        REFERENCES public.products(id, restaurant_id)
        ON DELETE SET NULL (product_id),
    CONSTRAINT chk_order_items_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.order_items IS 'Líneas de pedido con snapshot histórico del producto vendido.';

-- 2.9 ORDER ITEM ADDITIONS (Modifiers selected per order item) --------------
CREATE TABLE IF NOT EXISTS public.order_item_additions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_item_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    addition_id   TEXT,
    addition_name TEXT NOT NULL, -- historical snapshot
    unit_price    NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total         NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- WU-1b (M2/M3): la adición apunta a la línea de la misma orden/restaurante.
    CONSTRAINT fk_order_item_additions_order_item_tenant
        FOREIGN KEY (order_item_id, restaurant_id)
        REFERENCES public.order_items(id, restaurant_id)
        ON DELETE CASCADE,
    -- Schema integrity (0000000000007): the addition must belong to the same
    -- restaurant as the line; SET NULL nulls only addition_id.
    CONSTRAINT fk_order_item_additions_addition_tenant
        FOREIGN KEY (addition_id, restaurant_id)
        REFERENCES public.product_additions(id, restaurant_id)
        ON DELETE SET NULL (addition_id),
    CONSTRAINT chk_order_item_additions_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.order_item_additions IS 'Adiciones seleccionadas por línea de pedido (snapshot histórico).';

-- 2.10 SUPPLIERS (Inventory Suppliers) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    contact_name  TEXT,
    phone         TEXT,
    email         TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_suppliers_id_restaurant
        UNIQUE (id, restaurant_id),
    CONSTRAINT chk_suppliers_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.suppliers IS 'Proveedores de insumos por restaurante.';

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
        UNIQUE (id, restaurant_id),
    CONSTRAINT chk_inventory_items_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')
);

COMMENT ON TABLE public.inventory_items IS 'Inventario en unidades de compra (kg, litros, paquetes...).';
COMMENT ON COLUMN public.inventory_items.category IS 'Códigos: ingredients/beverages/packaging/cleaning/other (validados también en el backend).';

-- 2.12 ADMIN AUDIT LOG (Super admin audit trail) -----------------------------
-- Append-only. Actor and target are snapshots with NO foreign keys, so the
-- history survives deleting the user or the restaurant it describes. `details`
-- never holds credentials (the application sanitizes them out).
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id  TEXT,
    actor_username TEXT NOT NULL,
    action         TEXT NOT NULL,
    target_type    TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    target_label   TEXT NOT NULL DEFAULT '',
    restaurant_id  TEXT,
    details        JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_admin_audit_log_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_admin_audit_log_action
        CHECK (char_length(action) BETWEEN 1 AND 64),
    CONSTRAINT chk_admin_audit_log_target_type
        CHECK (target_type IN ('restaurant', 'user', 'role')),
    CONSTRAINT chk_admin_audit_log_details_object
        CHECK (jsonb_typeof(details) = 'object')
);

COMMENT ON TABLE public.admin_audit_log IS 'Auditoría append-only de acciones del super admin sobre restaurantes y usuarios. Sin claves foráneas: actor y objetivo son snapshots y el historial sobrevive al borrado de ambos.';
COMMENT ON COLUMN public.admin_audit_log.actor_user_id IS 'Id del usuario que actuó (sin FK: el usuario puede borrarse después). actor_username conserva el nombre.';
COMMENT ON COLUMN public.admin_audit_log.action IS 'restaurant.create|update|pause|activate|delete|restore, user.create|update|activate|deactivate|delete|reset_password.';
COMMENT ON COLUMN public.admin_audit_log.target_label IS 'Snapshot del nombre del restaurante o del username del usuario afectado al momento de la acción.';
COMMENT ON COLUMN public.admin_audit_log.restaurant_id IS 'Restaurante afectado o al que pertenece el usuario afectado (sin FK: un tenant borrado conserva su historial).';
COMMENT ON COLUMN public.admin_audit_log.details IS 'Nombres de campos cambiados y valores antes/después no secretos. Nunca contraseñas, hashes ni credenciales temporales.';


-- ============================================================================
-- 3. TRIGGERS (Automations inside Postgres Transactions)
-- ============================================================================

-- 3.0 Updated_at auto-management
DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at
    BEFORE UPDATE ON public.restaurant_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_branding_updated_at ON public.restaurant_branding;
CREATE TRIGGER trg_restaurant_branding_updated_at
    BEFORE UPDATE ON public.restaurant_branding
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

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON public.restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
    BEFORE UPDATE ON public.restaurant_tables
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

-- 3.2b Append-only audit trail (db-hardening-0008): history rows are only ever
-- inserted by log_order_status_change. app_user has no UPDATE/DELETE privilege
-- (section 6) and this trigger rejects UPDATE for any other role too. Deleting
-- an order still cascades into its history: referential actions run as the
-- table owner, so the revoked DELETE privilege does not apply to them.
CREATE OR REPLACE FUNCTION public.guard_order_status_history_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'order_status_history is append-only: rows cannot be updated'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_history_immutable ON public.order_status_history;
CREATE TRIGGER trg_order_status_history_immutable
    BEFORE UPDATE ON public.order_status_history
    FOR EACH ROW EXECUTE FUNCTION public.guard_order_status_history_immutable();

-- 3.2c Append-only admin audit trail: app_user has no UPDATE/DELETE privilege
-- (section 6) and this trigger rejects UPDATE for any other role too.
CREATE OR REPLACE FUNCTION public.guard_admin_audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_log is append-only: rows cannot be updated'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_immutable
    BEFORE UPDATE ON public.admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.guard_admin_audit_log_immutable();

-- 3.3 Atomic Customer Order Metrics Trigger -----------------------------------
CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_ids TEXT[];
    v_customer_id TEXT;
    v_restaurant_id TEXT;
    v_total_orders INTEGER;
    v_total_spent NUMERIC(12, 2);
    v_last_order_date TIMESTAMPTZ;
BEGIN
    -- NEW is an unassigned record in DELETE triggers: pick the row
    -- source by operation before touching any column (previously this
    -- COALESCE ran unconditionally and every DELETE on public.orders
    -- raised 'record "new" is not assigned yet').
    -- WU-1b (M2/M3): el agregado se filtra por el restaurante de la orden
    -- disparadora (fuente OLD/NEW según operación, igual que los customer ids)
    -- para que las ventas de un tenant jamás recomputen los totales de un
    -- customer de otro tenant, aunque hubiera entrado un link cross-tenant
    -- antes del fix de FKs compuestos.
    -- WU-4 (4.4): cuando customer_id cambia A -> B (o A -> NULL) se recomputan
    -- AMBOS clientes; antes solo se recomputaba COALESCE(NEW, OLD) y el
    -- cliente anterior conservaba totales obsoletos.
    IF TG_OP = 'DELETE' THEN
        v_customer_ids := ARRAY[OLD.customer_id];
        v_restaurant_id := OLD.restaurant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_ids := ARRAY[NEW.customer_id, OLD.customer_id];
        v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
    ELSE
        v_customer_ids := ARRAY[NEW.customer_id];
        v_restaurant_id := NEW.restaurant_id;
    END IF;

    -- db-hardening-0008 (T2): lock the customer row BEFORE aggregating. Under
    -- READ COMMITTED every statement takes a fresh snapshot, so once the lock is
    -- granted the aggregate below sees every order committed by the transaction
    -- that held it. Without the lock, two concurrent order writes for the same
    -- customer aggregate stale snapshots and the last UPDATE silently wins
    -- (lost update). ORDER BY gives a stable lock order when an UPDATE moves an
    -- order between two customers, so two such transactions cannot deadlock.
    FOR v_customer_id IN
        SELECT DISTINCT c FROM unnest(v_customer_ids) AS c WHERE c IS NOT NULL ORDER BY c
    LOOP
        PERFORM 1
        FROM public.customers
        WHERE id = v_customer_id
          AND restaurant_id = v_restaurant_id
        FOR UPDATE;

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
          AND restaurant_id = v_restaurant_id
          AND status != 'cancelled';

        UPDATE public.customers
        SET
            total_orders = v_total_orders,
            total_spent = v_total_spent,
            last_order_date = v_last_order_date,
            updated_at = NOW()
        WHERE id = v_customer_id
          AND restaurant_id = v_restaurant_id;
    END LOOP;

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
    -- 0. Tenant-context guard (C1): si la sesión declaró un restaurante vía
    -- GUC app.restaurant_id (lo hace PgClient.withTenantContext con SET LOCAL),
    -- DEBE coincidir con p_restaurant_id. Sin GUC (storefront público) no hay
    -- guard; con GUC y argumento distinto es un intento cross-tenant -> 42501.
    IF NULLIF(current_setting('app.restaurant_id', true), '') IS NOT NULL
       AND NULLIF(current_setting('app.restaurant_id', true), '') IS DISTINCT FROM p_restaurant_id THEN
        RAISE EXCEPTION 'Tenant context mismatch' USING ERRCODE = '42501';
    END IF;
    -- C1 bis: rechazar deltas no finitos/NULL (Infinity/-Infinity corromperían
    -- current_stock o bloquearían el guard de stock insuficiente).
    IF p_delta IS NULL OR p_delta = 'Infinity'::numeric OR p_delta = '-Infinity'::numeric THEN
        RAISE EXCEPTION 'Invalid quantity change';
    END IF;
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
-- SUS-19: the 9-arg overload is dropped in favor of the 10-arg signature with
-- p_client_order_id (idempotency replay). DROP persists the canonical form on
-- databases that already received the older overload; it is a no-op on fresh
-- ones, so the file stays idempotent.
DROP FUNCTION IF EXISTS public.create_order_atomic(
    text, text, text, text, numeric, numeric, text, jsonb, numeric
);
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_id TEXT,
    p_restaurant_id TEXT,
    p_customer_id TEXT,
    p_payment_method TEXT,
    p_payment_amount NUMERIC,
    p_change_amount NUMERIC,
    p_comment TEXT,
    p_items JSONB,
    p_delivery_fee NUMERIC DEFAULT NULL,
    p_client_order_id TEXT DEFAULT NULL
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
    -- Lean replay projection (C1): the replay path must NEVER return the full
    -- order row (customer, payments, comment, receipt) — it is a cross-tenant
    -- read vector when a session passes a foreign restaurant_id while another
    -- tenant's GUC is active. Only the fields the repositories need are read.
    v_replay_id TEXT;
    v_replay_order_number INTEGER;
    v_replay_status TEXT;
    v_replay_restaurant_id TEXT;
    v_replay_created_at TIMESTAMPTZ;
BEGIN
    -- 0. Tenant-context guard (C1): if the session declared a restaurant via
    -- GUC app.restaurant_id (PgClient.withTenantContext, SET LOCAL), it must
    -- match p_restaurant_id. Absent GUC (public storefront) = no guard.
    IF NULLIF(current_setting('app.restaurant_id', true), '') IS NOT NULL
       AND NULLIF(current_setting('app.restaurant_id', true), '') IS DISTINCT FROM p_restaurant_id THEN
        RAISE EXCEPTION 'Tenant context mismatch' USING ERRCODE = '42501';
    END IF;
    -- 0. SUS-19 idempotent replay by client correlation: an offline retry or a
    -- lost-response re-POST carries the same client_order_id, so the already
    -- persisted order is returned instead of inserting a duplicate sale. This
    -- runs before validation and BEFORE the INSERT: no second order_number is
    -- assigned and the order counters are never double-counted.
    IF p_client_order_id IS NOT NULL AND p_client_order_id <> '' THEN
        -- Serialize concurrent submissions of the same (restaurant, client id):
        -- the check-then-insert below is otherwise racy and the loser would hit
        -- uq_orders_client_order_id (23505 -> HTTP 500). The transaction-scoped
        -- advisory lock makes the second request wait for the first to commit,
        -- then take the replay branch. Released automatically at COMMIT/ROLLBACK.
        PERFORM pg_advisory_xact_lock(hashtext('create_order:' || p_restaurant_id || ':' || p_client_order_id));
        SELECT id, order_number, status, restaurant_id, created_at
        INTO v_replay_id, v_replay_order_number, v_replay_status, v_replay_restaurant_id, v_replay_created_at
        FROM public.orders
        WHERE restaurant_id = p_restaurant_id
          AND client_order_id = p_client_order_id;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_replay_id,
                'order_number', v_replay_order_number,
                'status', v_replay_status,
                'restaurant_id', v_replay_restaurant_id,
                'created_at', v_replay_created_at
            );
        END IF;
    END IF;
    -- 1. Validar estructura básica de items
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Validar que el restaurante exista y esté ACTIVO (delivery_fee y
    -- min_order_amount viven en restaurant_settings desde el split 3NF).
    SELECT r.*, s.delivery_fee, s.min_order_amount
    INTO v_rest
    FROM public.restaurants r
    LEFT JOIN public.restaurant_settings s ON s.restaurant_id = r.id
    WHERE r.id = p_restaurant_id;
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
        change_amount, comment, client_order_id, created_at, updated_at
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
        NULLIF(p_client_order_id, ''),
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
-- M1/C2 hardening: p_actor becomes mandatory (every status mutation must
-- record who did it), the tenant-context GUC guard is added, and the new 5th
-- parameter p_expected_status turns the write into a CAS: the UPDATE only
-- matches when the persisted status equals the snapshot the domain validated,
-- so a concurrent write (delivered -> cooking regression, cancel after
-- delivery) raises 'Order status changed concurrently' instead of silently
-- overwriting. The old 4-arg signature is DROPped — leaving it would keep a
-- bypass that accepts any actor-less call (nullable p_expected_status on the
-- new signature keeps 4-arg calls working via the DEFAULT). DROP IF EXISTS
-- keeps the file idempotent on fresh and migrated databases alike.
DROP FUNCTION IF EXISTS public.update_order_status_with_actor(
    text, text, text, text
);
CREATE OR REPLACE FUNCTION public.update_order_status_with_actor(
    p_order_id TEXT,
    p_new_status TEXT,
    p_restaurant_id TEXT,
    p_actor TEXT,
    p_expected_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    -- Actor obligatorio (C2): sin actor la mutación falla cerrado con 42501;
    -- nunca se acepta un cambio de estado sin registrar quién lo ejecutó.
    IF p_actor IS NULL OR p_actor = '' THEN
        RAISE EXCEPTION 'Actor is required' USING ERRCODE = '42501';
    END IF;

    -- Tenant-context guard (C1): if the session declared a restaurant via GUC
    -- app.restaurant_id, it must match p_restaurant_id (cross-tenant attempt).
    IF NULLIF(current_setting('app.restaurant_id', true), '') IS NOT NULL
       AND NULLIF(current_setting('app.restaurant_id', true), '') IS DISTINCT FROM p_restaurant_id THEN
        RAISE EXCEPTION 'Tenant context mismatch' USING ERRCODE = '42501';
    END IF;

    -- Validar actor: pertenece al restaurante (o es super_admin)
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_actor AND (restaurant_id = p_restaurant_id OR role = 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Actor % is not authorized for restaurant %', p_actor, p_restaurant_id USING ERRCODE = 'P0001';
    END IF;
    PERFORM set_config('app.actor', p_actor, true);

    -- Actualizar status aislando estrictamente por id Y restaurant_id, con CAS
    -- (M1): la fila solo se toca si su status actual coincide con el snapshot
    -- validado en el dominio (p_expected_status). Sin expected (legacy) el
    -- comportamiento previo se conserva.
    UPDATE public.orders
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_order_id AND restaurant_id = p_restaurant_id
      AND (p_expected_status IS NULL OR status = p_expected_status);

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected = 0 AND p_expected_status IS NOT NULL THEN
        RAISE EXCEPTION 'Order status changed concurrently' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_rows_affected > 0;
END;
$$;


-- ============================================================================
-- 5. PERFORMANCE INDEXES (Multi-Tenancy & Query Patterns)
-- ============================================================================
-- SUS-19: unique (restaurant_id, client_order_id) so a retried POST can never
-- insert a second sale. Partial (WHERE client_order_id IS NOT NULL) so
-- legacy/unknown flows stay unconstrained (skill: partial indexes for filtered
-- uniqueness; IF NOT EXISTS avoids the ADD CONSTRAINT IF NOT EXISTS trap).
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_client_order_id
    ON public.orders (restaurant_id, client_order_id)
    WHERE client_order_id IS NOT NULL;
-- Not created on purpose (0000000000007 drops them from migrated databases):
--   idx_users_username             = the users.username UNIQUE index
--   idx_customers_rest_phone       = uq_customers_restaurant_phone
--   idx_inventory_items_restaurant = leading column of idx_inventory_items_low_stock
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id       ON public.users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant     ON public.categories(restaurant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_cat   ON public.products(restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_available        ON public.products(restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_additions_restaurant_prod ON public.product_additions(restaurant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_rest_created       ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rest_status        ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer           ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_table              ON public.orders(table_id) WHERE table_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_tables_name ON public.restaurant_tables(restaurant_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_order   ON public.restaurant_tables(restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id      ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id    ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant    ON public.order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_item ON public.order_item_additions(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_addition ON public.order_item_additions(addition_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_restaurant ON public.order_item_additions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_restaurant ON public.order_status_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_restaurant ON public.admin_audit_log (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant      ON public.suppliers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock  ON public.inventory_items(restaurant_id, current_stock);


-- ============================================================================
-- 6. PERMISSIONS & ROLE CONFIGURATION
-- ============================================================================
GRANT USAGE ON SCHEMA public TO app_user;
-- Per-table grants instead of GRANT ... ON ALL TABLES: keeps each grant
-- statement's lock footprint to one table (see the lock discipline note
-- under section 7).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_branding TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_opening_hours TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_additions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_additions TO app_user;
-- Append-only audit trail: no UPDATE/DELETE for app_user (see 3.2b). The REVOKE
-- keeps a re-apply over an older database consistent.
GRANT SELECT, INSERT ON public.order_status_history TO app_user;
REVOKE UPDATE, DELETE ON public.order_status_history FROM app_user;
-- Append-only super admin audit trail: same shape (the REVOKE also covers the
-- default privileges below).
GRANT SELECT, INSERT ON public.admin_audit_log TO app_user;
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_order_counters TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- RLS helpers: read-only GUC lookups, no data access. PUBLIC keeps its default
-- EXECUTE on purpose: a session of another role (e.g. Supabase anon) must get an
-- empty result from the policies, not a permission error. The explicit grants
-- document the roles that rely on them.
GRANT EXECUTE ON FUNCTION public.app_current_restaurant_id() TO app_user;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO app_user;
GRANT EXECUTE ON FUNCTION public.app_current_restaurant_slug() TO app_user;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_current_restaurant_id() TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.app_current_restaurant_slug() TO service_role';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO app_user;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, TEXT) TO app_user;
-- M1/C2: the hardened signature is the 5-arg one (p_expected_status CAS); the
-- 4-arg overload was DROPped in section 4.3.
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_user;

-- JD-A-001: these SECURITY DEFINER mutation functions bypass RLS as owner, so
-- the default PUBLIC EXECUTE must be revoked — the anon key ships in the
-- frontend bundle and PUBLIC would let unauthenticated PostgREST callers
-- create orders, mutate order status and adjust stock. Only the authenticated
-- backend role app_user may execute them.
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
-- The deployed backend runs supabase-js with the service-role key (see
-- backend/src/infrastructure/persistence/supabase/SupabaseClient.ts), so
-- PostgREST executes these RPCs as service_role; re-grant EXECUTE to that
-- role, guarded so it is a no-op on vanilla PostgreSQL (docker-compose, CI
-- service containers) where the role does not exist. anon/authenticated
-- keep no EXECUTE: the anon key ships in the frontend bundle.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, TEXT) TO service_role';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role';
    END IF;
END;
$$;


-- ============================================================================
-- 7. ROW LEVEL SECURITY (Multi-Tenant Isolation & Storefront Access)
--
-- Lock discipline: DROP/CREATE POLICY and ALTER TABLE ... ROW LEVEL SECURITY
-- take ACCESS EXCLUSIVE table locks. This file is ONE atomic unit: it has no
-- transaction control of its own, so apply it as a single transaction
-- (`psql -v ON_ERROR_STOP=1 -1 -f 01_schema.sql`, or one multi-statement
-- driver query); a failure then leaves the database untouched instead of
-- half-built. The flip side is that a re-apply holds the ACE locks of every
-- table until the end, so it can deadlock against concurrent DML doing
-- foreign-key pre-checks (RowShare on child + parent tables). The guard lives
-- in the runner: run-postgres-tests.ts executes the postgres suites serially
-- (--fileParallelism=false), so the reapply never overlaps in-flight DML.
-- docker-entrypoint-initdb.d runs it with plain `psql -f` (autocommit,
-- non-atomic but on an empty database, which is fine).
-- Nothing here needs to run outside a transaction (no CREATE INDEX
-- CONCURRENTLY, no ALTER TYPE ... ADD VALUE).
-- ============================================================================
ALTER TABLE public.restaurants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branding       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branding       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_opening_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_opening_hours  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_additions         FORCE ROW LEVEL SECURITY;
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
ALTER TABLE public.admin_audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     FORCE ROW LEVEL SECURITY;

-- 7.1 Public Read Policies (Storefront Restaurant Resolution)
-- db-hardening-0008: public reads are no longer "any session sees every active
-- tenant". They apply ONLY to a session with no tenant context and no
-- super_admin role (the anonymous slug lookup) and ONLY to the one ACTIVE
-- restaurant whose slug the session declared in app.restaurant_slug. Products
-- and additions have no public policy: the storefront reads them under the
-- tenant context of the resolved restaurant (tenant_isolation_* policies).
DROP POLICY IF EXISTS "public_read_active_restaurants" ON public.restaurants;
CREATE POLICY "public_read_active_restaurants"
    ON public.restaurants FOR SELECT
    USING (
        is_active = TRUE
        AND (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND slug = (SELECT public.app_current_restaurant_slug())
    );

DROP POLICY IF EXISTS "public_read_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "public_read_restaurant_settings"
    ON public.restaurant_settings FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_settings.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "public_read_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "public_read_restaurant_branding"
    ON public.restaurant_branding FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_branding.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "public_read_restaurant_opening_hours" ON public.restaurant_opening_hours;
CREATE POLICY "public_read_restaurant_opening_hours"
    ON public.restaurant_opening_hours FOR SELECT
    USING (
        (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_opening_hours.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
    ON public.categories FOR SELECT
    USING (
        is_active = TRUE
        AND (SELECT public.app_current_restaurant_id()) IS NULL
        AND NOT (SELECT public.app_is_super_admin())
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.is_active = TRUE
              AND r.slug = (SELECT public.app_current_restaurant_slug())
        )
    );

-- Removed policies (kept as DROP so a re-apply over an older database closes them).
DROP POLICY IF EXISTS "public_read_available_products" ON public.products;
DROP POLICY IF EXISTS "public_read_available_additions" ON public.product_additions;

-- 7.2 Multi-Tenant Write & Admin Policies (Optimized with InitPlan caching)
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
            (SELECT public.app_is_super_admin())
            OR (
                (SELECT public.app_current_restaurant_id()) IS NOT NULL
                AND restaurant_id = (SELECT public.app_current_restaurant_id())
            )
        );
    
    -- INVARIANT (JD-INFO-6): public.users has FORCE ROW LEVEL SECURITY
    -- (see ALTER TABLE public.users ... FORCE below), which removes the
    -- default table-owner RLS bypass — a SECURITY DEFINER function only
    -- bypasses RLS here when its owner is superuser (or has BYPASSRLS).
    -- The functions below rely on being created by the migration role,
    -- which is a superuser in both documented deployment paths
    -- (docker-compose initdb runs as postgres; Supabase postgres is a
    -- superuser). If the schema is ever applied by a non-superuser role or
    -- function ownership is transferred, every login fails closed with 0
    -- rows — which is the safe direction, but keep the owner superuser.
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
        -- C2: the escape hatch is only reachable from the login-bootstrap path,
        -- which PgUserRepository marks by setting app.auth_bootstrap='true' via
        -- SET LOCAL. Any other session (PostgREST anon, a stray backend call)
        -- fails closed with 42501: password_hash must never be readable without
        -- an explicit bootstrap context.
        IF NULLIF(current_setting('app.auth_bootstrap', true), '') IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Auth bootstrap context required' USING ERRCODE = '42501';
        END IF;
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
        IF NULLIF(current_setting('app.auth_bootstrap', true), '') IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Auth bootstrap context required' USING ERRCODE = '42501';
        END IF;
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
            (SELECT public.app_is_super_admin())
            OR (
                restaurant_id = (SELECT public.app_current_restaurant_id())
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
                (SELECT public.app_is_super_admin())
                OR (
                    restaurant_id = (SELECT public.app_current_restaurant_id())
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
            -- Staff may never reassign roles (their own included): only an
            -- admin session may change which custom role a user holds.
            IF NEW.role_id IS DISTINCT FROM OLD.role_id
               AND (SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'restaurant_staff'::text THEN
                RAISE EXCEPTION USING ERRCODE = '42501',
                    MESSAGE = 'Staff users may not change a user''s custom role';
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
            (SELECT public.app_is_super_admin())
            OR (restaurant_id = (SELECT public.app_current_restaurant_id()))
        );
    
-- Restaurants write isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurants_write" ON public.restaurants;
CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING ((id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Restaurant Settings isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "tenant_isolation_restaurant_settings" ON public.restaurant_settings
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Restaurant Branding isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "tenant_isolation_restaurant_branding" ON public.restaurant_branding
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Restaurant Opening Hours isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_opening_hours" ON public.restaurant_opening_hours;
CREATE POLICY "tenant_isolation_restaurant_opening_hours" ON public.restaurant_opening_hours
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Restaurant Tables isolation (staff only: no public read)
DROP POLICY IF EXISTS "tenant_isolation_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "tenant_isolation_restaurant_tables" ON public.restaurant_tables
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Roles isolation
DROP POLICY IF EXISTS "tenant_isolation_roles" ON public.roles;
CREATE POLICY "tenant_isolation_roles" ON public.roles
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Categories isolation
DROP POLICY IF EXISTS "tenant_isolation_categories_select" ON public.categories;
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_write" ON public.categories;
CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_update" ON public.categories;
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_categories_delete" ON public.categories;
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Products isolation
DROP POLICY IF EXISTS "tenant_isolation_products_select" ON public.products;
CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_write" ON public.products;
CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_update" ON public.products;
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_products_delete" ON public.products;
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Product Additions isolation
DROP POLICY IF EXISTS "tenant_isolation_product_additions_select" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_write" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_update" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_delete" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Customers isolation
DROP POLICY IF EXISTS "tenant_isolation_customers" ON public.customers;
CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Orders isolation
DROP POLICY IF EXISTS "tenant_isolation_orders" ON public.orders;
CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Order Items isolation
DROP POLICY IF EXISTS "tenant_isolation_order_items" ON public.order_items;
CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Order Item Additions isolation
DROP POLICY IF EXISTS "tenant_isolation_order_item_additions" ON public.order_item_additions;
CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Order Status History isolation
DROP POLICY IF EXISTS "tenant_isolation_order_status_history" ON public.order_status_history;
CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Admin audit log: platform data, readable and appendable only by a super_admin
-- session (no UPDATE/DELETE policy exists)
DROP POLICY IF EXISTS "super_admin_read_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "super_admin_read_admin_audit_log" ON public.admin_audit_log
    FOR SELECT
    USING ((SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "super_admin_append_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "super_admin_append_admin_audit_log" ON public.admin_audit_log
    FOR INSERT
    WITH CHECK ((SELECT public.app_is_super_admin()));

-- Restaurant Order Counters isolation
DROP POLICY IF EXISTS "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters;
CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Suppliers isolation
DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

-- Inventory Items isolation
DROP POLICY IF EXISTS "tenant_isolation_inventory_items" ON public.inventory_items;
CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));
