-- ============================================================================
-- Migration 005 — feature/data-model-cleanup: reconcile schema.sql drift +
-- denormalize restaurant_id onto order_items, order_item_additions,
-- order_status_history
--
-- Contexto:
-- 1. create_order_atomic, update_order_status_with_actor y
--    log_order_status_change existen en la base real pero fueron borradas de
--    supabase/schema.sql en el commit 933024d sin actualizar el backend
--    (SupabaseOrderRepository.ts los sigue invocando). Esta migración las
--    reintroduce con su definición real (extraída de la base viva vía
--    pg_get_functiondef) más el agregado de restaurant_id.
-- 2. order_items, order_item_additions y order_status_history solo obtenían
--    restaurant_id indirectamente vía join con orders. Se denormaliza acá
--    para permitir políticas RLS directas sin joins (Fase 2 de este cambio).
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE donde aplica.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Agregar columnas (nullable primero, para poder backfillear)
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT;
ALTER TABLE public.order_item_additions ADD COLUMN IF NOT EXISTS restaurant_id TEXT;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS restaurant_id TEXT;

-- ----------------------------------------------------------------------------
-- 2. Backfill desde orders.restaurant_id (la fuente de verdad actual)
-- ----------------------------------------------------------------------------
UPDATE public.order_items oi
SET restaurant_id = o.restaurant_id
FROM public.orders o
WHERE oi.order_id = o.id
  AND oi.restaurant_id IS NULL;

UPDATE public.order_item_additions oia
SET restaurant_id = oi.restaurant_id
FROM public.order_items oi
WHERE oia.order_item_id = oi.id
  AND oia.restaurant_id IS NULL;

UPDATE public.order_status_history osh
SET restaurant_id = o.restaurant_id
FROM public.orders o
WHERE osh.order_id = o.id
  AND osh.restaurant_id IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Verificación de seguridad: no puede quedar ninguna fila sin backfillear
--    antes de forzar NOT NULL (aborta la migración completa si encuentra algo).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_orphan_count FROM public.order_items WHERE restaurant_id IS NULL;
    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION 'order_items tiene % filas sin restaurant_id backfilleado', v_orphan_count;
    END IF;

    SELECT COUNT(*) INTO v_orphan_count FROM public.order_item_additions WHERE restaurant_id IS NULL;
    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION 'order_item_additions tiene % filas sin restaurant_id backfilleado', v_orphan_count;
    END IF;

    SELECT COUNT(*) INTO v_orphan_count FROM public.order_status_history WHERE restaurant_id IS NULL;
    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION 'order_status_history tiene % filas sin restaurant_id backfilleado', v_orphan_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Forzar NOT NULL + FK a restaurants
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.order_item_additions ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE public.order_status_history ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE public.order_items
    ADD CONSTRAINT fk_order_items_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.order_item_additions
    ADD CONSTRAINT fk_order_item_additions_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.order_status_history
    ADD CONSTRAINT fk_order_status_history_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. Índices nuevos (denormalización + FK sin cobertura detectada por el
--    advisor de performance)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON public.order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_restaurant ON public.order_item_additions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_additions_addition ON public.order_item_additions(addition_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_restaurant ON public.order_status_history(restaurant_id);

-- ----------------------------------------------------------------------------
-- 6. Reconciliar trigger log_order_status_change (agrega restaurant_id)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7. Reconciliar create_order_atomic (agrega restaurant_id a order_items /
--    order_item_additions) y endurecer permisos igual que adjust_inventory_stock
-- ----------------------------------------------------------------------------
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
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_rest.is_active THEN
        RAISE EXCEPTION 'Restaurant % is inactive', v_rest.name USING ERRCODE = 'P0001';
    END IF;

    IF p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
        IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND restaurant_id = p_restaurant_id) THEN
            RAISE EXCEPTION 'Customer % does not belong to restaurant %', p_customer_id, p_restaurant_id USING ERRCODE = 'P0001';
        END IF;
    END IF;

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

    IF v_rest.min_order_amount > 0 AND v_calculated_subtotal < v_rest.min_order_amount THEN
        RAISE EXCEPTION 'Subtotal % is below minimum order amount %', v_calculated_subtotal, v_rest.min_order_amount USING ERRCODE = 'P0001';
    END IF;

    v_final_total := v_calculated_subtotal + v_rest.delivery_fee;
    IF p_payment_method = 'Efectivo' AND p_payment_amount IS NOT NULL THEN
        IF p_payment_amount < v_final_total THEN
            RAISE EXCEPTION 'Payment amount % is less than final total %', p_payment_amount, v_final_total USING ERRCODE = 'P0001';
        END IF;
    END IF;

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

-- ----------------------------------------------------------------------------
-- 8. Reconciliar update_order_status_with_actor (sin cambio de cuerpo, solo
--    endurecer permisos igual que adjust_inventory_stock)
-- ----------------------------------------------------------------------------
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
    IF p_actor IS NOT NULL AND p_actor <> '' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor AND (restaurant_id = p_restaurant_id OR role = 'super_admin')
        ) THEN
            RAISE EXCEPTION 'Actor % is not authorized for restaurant %', p_actor, p_restaurant_id USING ERRCODE = 'P0001';
        END IF;
        PERFORM set_config('app.actor', p_actor, true);
    END IF;

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

-- ----------------------------------------------------------------------------
-- 9. Verificación post-migración
-- ----------------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM public.order_items WHERE restaurant_id IS NULL) AS order_items_sin_restaurant,
    (SELECT COUNT(*) FROM public.order_item_additions WHERE restaurant_id IS NULL) AS order_item_additions_sin_restaurant,
    (SELECT COUNT(*) FROM public.order_status_history WHERE restaurant_id IS NULL) AS order_status_history_sin_restaurant;
-- Resultado esperado: 0, 0, 0 (las columnas son NOT NULL, así que esto es
-- solo una doble verificación defensiva).
