-- ============================================================================
-- 0000000000005_order_submission_idempotency.up.sql
-- WU-2 (functional-flow-fixes): concurrent submissions of the same
-- client_order_id no longer race into uq_orders_client_order_id (23505 -> 500).
-- create_order_atomic takes a transaction-scoped advisory lock keyed by
-- (restaurant_id, client_order_id) before the replay lookup, so the second
-- request waits for the first to commit and then returns the original order.
--
-- Safe on live data: CREATE OR REPLACE with the identical 10-arg signature
-- (privileges and dependencies are preserved, no table is touched, no data is
-- rewritten). Idempotent: re-running it re-installs the same body.
-- The function body is byte-identical to database/01_schema.sql section 4.2.
-- ============================================================================

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
