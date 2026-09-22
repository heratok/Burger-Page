-- ============================================================================
-- 0001_restaurant_settings_branding.sql (UP)
-- Split 3NF de restaurants (auditoría de arquitecto):
--   identidad (restaurants) + configuración operativa (restaurant_settings)
--   + identidad visual (restaurant_branding), todo 1:1 (FK ON DELETE CASCADE).
-- El baseline se crea desde database/01_schema.sql (ya dividido); esta
-- migración cubre la evolución de una base existente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    restaurant_id           TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    currency                TEXT NOT NULL DEFAULT 'COP',
    currency_symbol         TEXT NOT NULL DEFAULT '$',
    delivery_fee            NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    min_order_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
    estimated_delivery_time TEXT DEFAULT '30 - 45 min',
    opening_hours_text      TEXT DEFAULT '12:00 - 22:30',
    open_time               TIME DEFAULT '12:00',
    close_time              TIME DEFAULT '22:30',
    announcement_text       TEXT,
    show_announcement       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Backfill 1:1 desde las columnas que aún existen en restaurants
INSERT INTO public.restaurant_settings (
    restaurant_id, currency, currency_symbol, delivery_fee, min_order_amount,
    estimated_delivery_time, opening_hours_text, open_time, close_time,
    announcement_text, show_announcement, created_at, updated_at
)
SELECT
    id, currency, currency_symbol, delivery_fee, min_order_amount,
    estimated_delivery_time, opening_hours_text, open_time, close_time,
    announcement_text, show_announcement, created_at, updated_at
FROM public.restaurants
WHERE id NOT IN (SELECT restaurant_id FROM public.restaurant_settings);

INSERT INTO public.restaurant_branding (
    restaurant_id, logo_url, banner_url, show_banner, primary_color,
    primary_hover_color, bg_theme, font_family, card_radius, card_style,
    compact_grid, show_badges, created_at, updated_at
)
SELECT
    id, logo_url, banner_url, show_banner, primary_color, primary_hover_color,
    bg_theme, font_family, card_radius, card_style, compact_grid, show_badges,
    created_at, updated_at
FROM public.restaurants
WHERE id NOT IN (SELECT restaurant_id FROM public.restaurant_branding);

-- Ahora sí se quitan las columnas de la tabla de identidad
ALTER TABLE public.restaurants
    DROP COLUMN IF EXISTS logo_url,
    DROP COLUMN IF EXISTS banner_url,
    DROP COLUMN IF EXISTS show_banner,
    DROP COLUMN IF EXISTS announcement_text,
    DROP COLUMN IF EXISTS show_announcement,
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS currency_symbol,
    DROP COLUMN IF EXISTS delivery_fee,
    DROP COLUMN IF EXISTS min_order_amount,
    DROP COLUMN IF EXISTS estimated_delivery_time,
    DROP COLUMN IF EXISTS opening_hours_text,
    DROP COLUMN IF EXISTS open_time,
    DROP COLUMN IF EXISTS close_time,
    DROP COLUMN IF EXISTS primary_color,
    DROP COLUMN IF EXISTS primary_hover_color,
    DROP COLUMN IF EXISTS bg_theme,
    DROP COLUMN IF EXISTS font_family,
    DROP COLUMN IF EXISTS card_radius,
    DROP COLUMN IF EXISTS card_style,
    DROP COLUMN IF EXISTS compact_grid,
    DROP COLUMN IF EXISTS show_badges;

-- Triggers, grants y RLS (mismo patrón que el canon; ver 01_schema.sql)
DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at
    BEFORE UPDATE ON public.restaurant_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_restaurant_branding_updated_at ON public.restaurant_branding;
CREATE TRIGGER trg_restaurant_branding_updated_at
    BEFORE UPDATE ON public.restaurant_branding
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_branding TO app_user;

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branding FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "public_read_restaurant_settings"
    ON public.restaurant_settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "public_read_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "public_read_restaurant_branding"
    ON public.restaurant_branding FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "tenant_isolation_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "tenant_isolation_restaurant_settings" ON public.restaurant_settings
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));
DROP POLICY IF EXISTS "tenant_isolation_restaurant_branding" ON public.restaurant_branding;
CREATE POLICY "tenant_isolation_restaurant_branding" ON public.restaurant_branding
    FOR ALL
    USING ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = (SELECT NULLIF(current_setting('app.restaurant_id'::text, true), ''))) OR ((SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'super_admin'::text));

-- create_order_atomic resuelve fee/mínimo desde restaurant_settings.
-- Definición copiada EXACTA de database/01_schema.sql (fuente única, sin drift):
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
BEGIN
    -- 0. SUS-19 idempotent replay by client correlation: an offline retry or a
    -- lost-response re-POST carries the same client_order_id, so the already
    -- persisted order is returned instead of inserting a duplicate sale. This
    -- runs before validation and BEFORE the INSERT: no second order_number is
    -- assigned and the order counters are never double-counted.
    IF p_client_order_id IS NOT NULL AND p_client_order_id <> '' THEN
        SELECT * INTO v_created_order FROM public.orders
        WHERE restaurant_id = p_restaurant_id
          AND client_order_id = p_client_order_id;
        IF FOUND THEN
            RETURN to_jsonb(v_created_order);
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

-- JD-A-001: this copy of create_order_atomic is SECURITY DEFINER. The
-- CREATE OR REPLACE above preserves privileges loaded with the original
-- baseline, where PUBLIC held EXECUTE by default; revoke it here too for
-- existing databases that never re-apply 01_schema.sql (idempotent, mirrors
-- the REVOKE in database/01_schema.sql). The .down.sql needs no mirror: it
-- neither drops nor re-grants this function.
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, TEXT) FROM PUBLIC;
-- JD-A-001: the deployed backend runs supabase-js with the service-role key
-- (backend/src/infrastructure/persistence/supabase/SupabaseClient.ts), so
-- PostgREST executes this RPC as service_role; re-grant EXECUTE to that role
-- for existing databases that never re-apply 01_schema.sql, guarded so it is
-- a no-op on vanilla PostgreSQL where the role does not exist.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, TEXT) TO service_role';
    END IF;
END;
$$;
