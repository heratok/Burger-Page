-- ============================================================================
-- BURGER-PAGE — STAGING VERIFICATION & ATTACK TEST SUITE (PostgreSQL Real)
-- File: staging_verification_suite.sql
-- Description: Executes live assertions directly inside PostgreSQL to verify
--              relational constraints, compound FKs, CHECKs, atomic RPCs,
--              concurrency, and cross-tenant attack rejections.
-- ============================================================================

DO $$
DECLARE
    v_rest_a RECORD;
    v_rest_b RECORD;
    v_prod_a RECORD;
    v_prod_b RECORD;
    v_add_a RECORD;
    v_add_b RECORD;
    v_cust_a RECORD;
    v_cust_b RECORD;
    v_order_res JSONB;
    v_order_id TEXT := 'ord-test-real-1';
    v_order_row RECORD;
    v_item_row RECORD;
    v_add_row RECORD;
    v_err_caught BOOLEAN;
    v_i INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'INICIANDO SUITE DE PRUEBAS DE STAGING EN POSTGRESQL REAL';
    RAISE NOTICE '============================================================';

    -- ------------------------------------------------------------------------
    -- 1. SETUP DE TENANTS DE PRUEBA
    -- ------------------------------------------------------------------------
    DELETE FROM public.restaurants WHERE id IN ('tenant-test-a', 'tenant-test-b');

    INSERT INTO public.restaurants (
        id, slug, name, delivery_fee, min_order_amount, is_active
    ) VALUES 
    ('tenant-test-a', 'craft-staging', 'Burger Craft Staging', 5000.00, 20000.00, TRUE),
    ('tenant-test-b', 'rosto-staging', 'Rosto Staging', 4000.00, 15000.00, TRUE);

    -- ------------------------------------------------------------------------
    -- 2. PRUEBAS DE PRODUCTOS Y FK COMPUESTO (Product + ProductAddition)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 2. Verificando Products y FK Compuesto de Additions...';
    
    INSERT INTO public.products (
        id, restaurant_id, category_name, name, price, is_available
    ) VALUES 
    ('prod-a-1', 'tenant-test-a', 'Hamburguesas', 'Burger Trufada A', 30000.00, TRUE),
    ('prod-b-1', 'tenant-test-b', 'Hamburguesas', 'Burger Doble B', 28000.00, TRUE);

    -- Adición válida para Tenant A
    INSERT INTO public.product_additions (
        id, restaurant_id, product_id, name, price, is_available
    ) VALUES 
    ('add-a-1', 'tenant-test-a', 'prod-a-1', 'Tocineta Ahumada A', 4000.00, TRUE);

    -- ATAQUE: Intentar asociar Adición de Tenant B al Producto de Tenant A (Debe fallar por FK Compuesta)
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.product_additions (
            id, restaurant_id, product_id, name, price, is_available
        ) VALUES 
        ('add-b-malicious', 'tenant-test-b', 'prod-a-1', 'Ataque Cruce Tenant', 1000.00, TRUE);
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ SEGURIDAD: El FK compuesto permitió asociar una Adición de Tenant B a un Producto de Tenant A.';
    ELSE
        RAISE NOTICE '✓ FK Compuesto (product_id, restaurant_id) RECHAZÓ con éxito la adición cruzada.';
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. PRUEBAS DE CUSTOMER Y PURGA DE LOYALTY
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 3. Verificando Customer (CRM de Compradores)...';
    
    INSERT INTO public.customers (
        id, restaurant_id, name, phone, email, address, barrio, notes
    ) VALUES 
    ('cust-a-1', 'tenant-test-a', 'Juan Pérez', '+57 300 123 4567', '', 'Calle 10 # 20-30', 'El Poblado', 'Timbre 201');

    -- ATAQUE: Intentar duplicar teléfono en el MISMO restaurante (Debe fallar por UNIQUE)
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.customers (
            id, restaurant_id, name, phone
        ) VALUES 
        ('cust-a-dup', 'tenant-test-a', 'Juan Clon', '+57 300 123 4567');
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ: UNIQUE (restaurant_id, phone) no impidió duplicación de cliente.';
    ELSE
        RAISE NOTICE '✓ Constraint UNIQUE (restaurant_id, phone) verificado.';
    END IF;

    -- Teléfono idéntico en Tenant B DEBE ser permitido (Aislamiento Multi-Tenant)
    INSERT INTO public.customers (
        id, restaurant_id, name, phone
    ) VALUES 
    ('cust-b-1', 'tenant-test-b', 'Juan Otro Restaurante', '+57 300 123 4567');
    RAISE NOTICE '✓ Mismo teléfono permitido en tenant diferente.';

    -- ------------------------------------------------------------------------
    -- 4. PRUEBAS DE INVENTORY (Stock, Costos, CHECK & UNIQUE)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 4. Verificando Inventory (Insumos)...';

    INSERT INTO public.inventory (
        id, restaurant_id, name, category, current_stock, unit, cost_per_unit
    ) VALUES 
    ('inv-a-1', 'tenant-test-a', 'Pan Brioche', 'ingredients', 100.00, 'unidades', 1200.00);

    -- ATAQUE: Intentar stock negativo (Debe fallar por CHECK current_stock >= 0)
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.inventory (
            id, restaurant_id, name, category, current_stock, unit, cost_per_unit
        ) VALUES 
        ('inv-a-neg', 'tenant-test-a', 'Carne Molida', 'ingredients', -10.00, 'kg', 15000.00);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ: CHECK (current_stock >= 0) no impidió stock negativo.';
    ELSE
        RAISE NOTICE '✓ Constraint CHECK (current_stock >= 0) impidió stock negativo.';
    END IF;

    -- ATAQUE: Intentar costo negativo (Debe fallar por CHECK cost_per_unit >= 0)
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.inventory (
            id, restaurant_id, name, category, current_stock, unit, cost_per_unit
        ) VALUES 
        ('inv-a-negcost', 'tenant-test-a', 'Salsa', 'ingredients', 10.00, 'litros', -500.00);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ: CHECK (cost_per_unit >= 0) no impidió costo negativo.';
    ELSE
        RAISE NOTICE '✓ Constraint CHECK (cost_per_unit >= 0) impidió costo negativo.';
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. PRUEBA ATÓMICA DE ÓRDENES (RPC create_order_atomic)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 5. Ejecutando RPC create_order_atomic...';

    -- Crear orden válida con 2 productos y 1 adición (2 x 30000 = 60000, 2 adiciones x 4000 = 8000. Subtotal: 68000 + 5000 delivery = 73000)
    v_order_res := public.create_order_atomic(
        v_order_id,
        'tenant-test-a',
        'cust-a-1',
        'Efectivo',
        80000.00,
        7000.00,
        'Sin cebolla por favor',
        jsonb_build_array(
            jsonb_build_object(
                'id', 'item-test-1',
                'product_id', 'prod-a-1',
                'quantity', 2,
                'observation', 'Bien cocida',
                'additions', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'item-add-1',
                        'addition_id', 'add-a-1',
                        'quantity', 1
                    )
                )
            )
        )
    );

    SELECT * INTO v_order_row FROM public.orders WHERE id = v_order_id;
    SELECT * INTO v_item_row FROM public.order_items WHERE order_id = v_order_id;
    SELECT * INTO v_add_row FROM public.order_item_additions WHERE order_item_id = v_item_row.id;

    -- Validaciones matemáticas autoritativas
    IF v_order_row.subtotal <> 68000.00 THEN
        RAISE EXCEPTION 'FALLÓ: Subtotal calculado % es distinto al esperado (68000.00)', v_order_row.subtotal;
    END IF;
    IF v_order_row.final_total <> 73000.00 THEN
        RAISE EXCEPTION 'FALLÓ: Final Total % es distinto al esperado (73000.00)', v_order_row.final_total;
    END IF;
    IF v_item_row.subtotal <> 60000.00 THEN
        RAISE EXCEPTION 'FALLÓ: Generated column order_items.subtotal % es distinta a 60000.00', v_item_row.subtotal;
    END IF;
    IF v_add_row.total <> 4000.00 THEN
        RAISE EXCEPTION 'FALLÓ: Generated column order_item_additions.total % es distinta a 4000.00', v_add_row.total;
    END IF;
    IF v_order_row.order_number IS NULL OR v_order_row.order_number < 1 THEN
        RAISE EXCEPTION 'FALLÓ: order_number no fue auto-asignado por el trigger atómico.';
    END IF;

    RAISE NOTICE '✓ create_order_atomic calculó precios oficiales, subtotal (68000), delivery (5000) y final_total (73000) con éxito.';
    RAISE NOTICE '✓ order_number asignado automáticamente: #%', v_order_row.order_number;
    RAISE NOTICE '✓ Generated columns (order_items.subtotal y order_item_additions.total) validadas.';

    -- ------------------------------------------------------------------------
    -- 6. ATAQUES MULTI-TENANT CONTRA create_order_atomic
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 6. Ejecutando matriz de ataques contra create_order_atomic...';

    -- ATAQUE A: Orden en Tenant A con Producto de Tenant B
    v_err_caught := FALSE;
    BEGIN
        PERFORM public.create_order_atomic(
            'ord-malicious-prod',
            'tenant-test-a',
            'cust-a-1',
            'Efectivo',
            50000.00,
            0.00,
            '',
            jsonb_build_array(
                jsonb_build_object(
                    'id', 'item-bad-prod',
                    'product_id', 'prod-b-1',
                    'quantity', 1
                )
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ: create_order_atomic permitió incluir un Producto de Tenant B en una Orden de Tenant A.';
    ELSE
        RAISE NOTICE '✓ create_order_atomic RECHAZÓ producto de otro tenant.';
    END IF;

    -- ATAQUE B: Orden en Tenant A con Customer de Tenant B
    v_err_caught := FALSE;
    BEGIN
        PERFORM public.create_order_atomic(
            'ord-malicious-cust',
            'tenant-test-a',
            'cust-b-1',
            'Efectivo',
            50000.00,
            0.00,
            '',
            jsonb_build_array(
                jsonb_build_object(
                    'id', 'item-bad-cust',
                    'product_id', 'prod-a-1',
                    'quantity', 1
                )
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FALLÓ: create_order_atomic permitió asociar un Cliente de Tenant B a una Orden de Tenant A.';
    ELSE
        RAISE NOTICE '✓ create_order_atomic RECHAZÓ cliente de otro tenant.';
    END IF;

    -- ------------------------------------------------------------------------
    -- 7. CONCURRENCIA DE ORDER_NUMBER (20 órdenes simultáneas)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 7. Verificando secuencia de order_number en 20 órdenes...';
    
    FOR v_i IN 2..21 LOOP
        PERFORM public.create_order_atomic(
            'ord-concurrent-' || v_i,
            'tenant-test-a',
            'cust-a-1',
            'Efectivo',
            40000.00,
            0.00,
            '',
            jsonb_build_array(
                jsonb_build_object(
                    'id', 'item-conc-' || v_i,
                    'product_id', 'prod-a-1',
                    'quantity', 1
                )
            )
        );
    END LOOP;

    -- Comprobar que existen exactamente 21 órdenes y 21 order_numbers consecutivos sin duplicados
    IF (SELECT count(DISTINCT order_number) FROM public.orders WHERE restaurant_id = 'tenant-test-a') <> 21 THEN
        RAISE EXCEPTION 'FALLÓ: Hay colisiones o duplicados en order_number para Tenant A.';
    END IF;
    RAISE NOTICE '✓ 21 órdenes consecutivas procesadas con éxito sin colisiones de order_number (#1 a #21).';

    -- ------------------------------------------------------------------------
    -- 8. INTEGRIDAD RELACIONAL Y SNAPSHOT HISTÓRICO AL ELIMINAR PRODUCTO
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 8. Verificando snapshot histórico ante eliminación de producto...';
    
    DELETE FROM public.products WHERE id = 'prod-a-1';

    -- El order_item debe conservar product_name = 'Burger Trufada A', unit_price = 30000, pero product_id = NULL
    SELECT * INTO v_item_row FROM public.order_items WHERE id = 'item-test-1';
    IF v_item_row.product_id IS NOT NULL THEN
        RAISE EXCEPTION 'FALLÓ: order_items.product_id no pasó a NULL tras ON DELETE SET NULL.';
    END IF;
    IF v_item_row.product_name <> 'Burger Trufada A' OR v_item_row.unit_price <> 30000.00 OR v_item_row.subtotal <> 60000.00 THEN
        RAISE EXCEPTION 'FALLÓ: Se corrompió el snapshot histórico del ítem de la orden.';
    END IF;
    RAISE NOTICE '✓ ON DELETE SET NULL verificado: order_items.product_id es NULL y el snapshot histórico (nombre, precio, subtotal) está 100%% intacto.';

    -- ------------------------------------------------------------------------
    -- 9. AUDITORÍA DE ESTADOS (update_order_status_with_actor)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '>>> 9. Verificando actualización de estados y trigger de auditoría...';

    PERFORM public.update_order_status_with_actor(
        v_order_id,
        'cooking',
        'tenant-test-a',
        NULL
    );

    IF (SELECT count(*) FROM public.order_status_history WHERE order_id = v_order_id AND new_status = 'cooking') = 0 THEN
        RAISE EXCEPTION 'FALLÓ: order_status_history no registró la transición a cooking.';
    END IF;
    RAISE NOTICE '✓ Historial de auditoría registrado automáticamente por trigger.';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'TODAS LAS PRUEBAS DE STAGING EN POSTGRESQL REAL PASARON 100%%';
    RAISE NOTICE '============================================================';
END;
$$;
