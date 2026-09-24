-- ============================================================================
-- 0000000000003_tenant_isolation_hardening.up.sql
-- WU-1 hardening de tenant isolation sobre SECURITY DEFINER functions
-- (C1/C2/M1 del feature tenant-isolation-hardening). Reaplica solo las
-- funciones cambiadas y sus grants, idempotente sobre un esquema ya migrado:
-- DROP IF EXISTS / CREATE OR REPLACE y GRANT/REVOKE por firma exacta.
-- ============================================================================

-- ── 1. adjust_inventory_stock: tenant-context GUC guard + non-finite delta ──
-- Guard C1: si la sesión declaró app.restaurant_id (SET LOCAL en
-- PgClient.withTenantContext), debe coincidir con p_restaurant_id; sin GUC
-- (storefront público) no hay guard. Delta no finito/NULL se rechaza.
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
    -- 0. Tenant-context guard (C1)
    IF NULLIF(current_setting('app.restaurant_id', true), '') IS NOT NULL
       AND NULLIF(current_setting('app.restaurant_id', true), '') IS DISTINCT FROM p_restaurant_id THEN
        RAISE EXCEPTION 'Tenant context mismatch' USING ERRCODE = '42501';
    END IF;
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

-- ── 2. create_order_atomic: GUC guard + lean replay projection (C1) ─────────
-- El replay de idempotencia devuelve SOLO id/order_number/status/restaurant_id/
-- created_at (jsonb_build_object): nunca la fila completa (customer, pagos,
-- comment, receipt), que era un vector de lectura cross-tenant.
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
    -- Lean replay projection (C1): never return the full order row.
    v_replay_id TEXT;
    v_replay_order_number INTEGER;
    v_replay_status TEXT;
    v_replay_restaurant_id TEXT;
    v_replay_created_at TIMESTAMPTZ;
BEGIN
    -- 0. Tenant-context guard (C1): GUC app.restaurant_id must match
    -- p_restaurant_id when the session declared one (absent GUC = storefront).
    IF NULLIF(current_setting('app.restaurant_id', true), '') IS NOT NULL
       AND NULLIF(current_setting('app.restaurant_id', true), '') IS DISTINCT FROM p_restaurant_id THEN
        RAISE EXCEPTION 'Tenant context mismatch' USING ERRCODE = '42501';
    END IF;
    -- 0. SUS-19 idempotent replay: lean projection, runs before validation and
    -- BEFORE the INSERT (no second order_number, counters never double-counted).
    IF p_client_order_id IS NOT NULL AND p_client_order_id <> '' THEN
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

    -- 2b. Validate the client-provided delivery fee when present.
    IF p_delivery_fee IS NOT NULL AND p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee: %', p_delivery_fee USING ERRCODE = 'P0001';
    END IF;

    -- 3. Validar customer_id si fue provisto
    IF p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
        IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND restaurant_id = p_restaurant_id) THEN
            RAISE EXCEPTION 'Customer % does not belong to restaurant %', p_customer_id, p_restaurant_id USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 4. Crear cabecera temporal de la orden con subtotal 0
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

    -- 5. Iterar sobre los items consultando el precio REAL en 'products'
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

        -- 6. Iterar sobre las adiciones consultando el precio REAL
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

-- ── 3. update_order_status_with_actor: actor obligatorio + CAS (5-arg) (C2/M1) ──
-- Se DROPea la firma 4-arg: dejarla viva mantendría un bypass sin actor. La
-- firma nueva (p_expected_status DEFAULT NULL) conserva las llamadas 4-arg vía
-- DEFAULT. 4-arg no-CAS devuelve false si no hay fila (comportamiento previo);
-- 5-arg con snapshot stale RAISE P0001 'Order status changed concurrently'.
DROP FUNCTION IF EXISTS public.update_order_status_with_actor(
    TEXT, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.update_order_status_with_actor(
    TEXT, TEXT, TEXT, TEXT, TEXT
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
    -- Actor obligatorio (C2): fail closed si no llega quién ejecuta la mutación.
    IF p_actor IS NULL OR p_actor = '' THEN
        RAISE EXCEPTION 'Actor is required' USING ERRCODE = '42501';
    END IF;

    -- Tenant-context guard (C1)
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

    -- Actualizar status aislando por id Y restaurant_id, con CAS (M1)
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

-- ── 4. look_up_user_for_auth / _by_id: gate app.auth_bootstrap (C2) ─────────
-- Sin el GUC de bootstrap la función falla cerrado con 42501: password_hash no
-- debe leerse sin contexto explícito de login. PgUserRepository.findByUsername/
-- findById setean el GUC vía SET LOCAL antes del lookup.
CREATE OR REPLACE FUNCTION public.look_up_user_for_auth(p_username TEXT)
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
    WHERE username = p_username
    LIMIT 1;
END;
$$;

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

-- ── 5. Grants de la firma nueva (la 4-arg desapareció con el DROP) ───────────
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_user;
REVOKE EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role';
    END IF;
END;
$$;