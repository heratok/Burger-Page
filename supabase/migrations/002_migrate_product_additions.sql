-- ============================================================================
-- Migration 002 — feature/data-model-cleanup: Migrate products.additions → product_additions
-- Run in: Supabase Dashboard → SQL Editor (DO NOT RUN AUTOMATICALLY)
-- Safe to run multiple times (Idempotent: skips existing additions).
-- Note: Does NOT drop the legacy additions column (non-destructive).
-- ============================================================================

DO $$
DECLARE
    v_migration_started_at   TIMESTAMPTZ := NOW();
    v_col_type               TEXT;
    v_prod_rec               RECORD;
    v_elem                   RECORD;
    v_elem_text              TEXT;
    v_elem_json              JSONB;
    v_addition_name          TEXT;
    v_addition_price         NUMERIC(12, 2);
    v_display_order          INTEGER;
    
    -- Diagnostic Counters
    c_products_total         INTEGER := 0;
    c_products_with_additions INTEGER := 0;
    c_products_empty_or_null INTEGER := 0;
    c_additions_inserted     INTEGER := 0;
    c_additions_skipped_dup  INTEGER := 0;
    c_additions_skipped_bad  INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '🚀 INICIANDO MIGRACIÓN: products.additions → product_additions';
    RAISE NOTICE '⏱️  Timestamp de inicio: %', v_migration_started_at;
    RAISE NOTICE '============================================================';

    -- 1. Verificar si la columna legacy 'additions' existe en 'products'
    SELECT data_type INTO v_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = 'additions';

    IF v_col_type IS NULL THEN
        RAISE NOTICE 'ℹ️  La columna "additions" no existe en "public.products". Nada que migrar.';
        RETURN;
    END IF;

    RAISE NOTICE 'Tipo de dato detectado en products.additions: %', v_col_type;

    -- 2. Procesar productos (global para todos los restaurantes)
    FOR v_prod_rec IN
        SELECT id, restaurant_id, name, additions
        FROM public.products
        ORDER BY restaurant_id, name
    LOOP
        c_products_total := c_products_total + 1;
        v_display_order := 0;

        -- Caso A: Columna de tipo JSONB o JSON
        IF v_col_type IN ('jsonb', 'json') THEN
            IF v_prod_rec.additions IS NULL 
               OR jsonb_typeof(v_prod_rec.additions::jsonb) <> 'array' 
               OR jsonb_array_length(v_prod_rec.additions::jsonb) = 0 THEN
                c_products_empty_or_null := c_products_empty_or_null + 1;
                CONTINUE;
            END IF;

            c_products_with_additions := c_products_with_additions + 1;

            FOR v_elem IN
                SELECT value AS item
                FROM jsonb_array_elements(v_prod_rec.additions::jsonb)
            LOOP
                v_elem_json := v_elem.item;

                -- Extraer nombre y precio según formato (string plano o json objeto)
                IF jsonb_typeof(v_elem_json) = 'string' THEN
                    v_addition_name := TRIM(BOTH '"' FROM v_elem_json::text);
                    v_addition_price := 0.00;
                ELSIF jsonb_typeof(v_elem_json) = 'object' THEN
                    v_addition_name := TRIM(BOTH '"' FROM (v_elem_json->>'name')::text);
                    BEGIN
                        v_addition_price := COALESCE((v_elem_json->>'price')::numeric, 0.00);
                    EXCEPTION WHEN OTHERS THEN
                        v_addition_price := 0.00;
                    END;
                ELSE
                    c_additions_skipped_bad := c_additions_skipped_bad + 1;
                    CONTINUE;
                END IF;

                -- Validar que el nombre no sea vacío
                IF v_addition_name IS NULL OR LENGTH(TRIM(v_addition_name)) = 0 THEN
                    c_additions_skipped_bad := c_additions_skipped_bad + 1;
                    CONTINUE;
                END IF;

                v_addition_name := TRIM(v_addition_name);

                -- Idempotencia: Verificar si ya existe en product_additions
                IF EXISTS (
                    SELECT 1
                    FROM public.product_additions pa
                    WHERE pa.restaurant_id = v_prod_rec.restaurant_id
                      AND pa.product_id = v_prod_rec.id
                      AND LOWER(TRIM(pa.name)) = LOWER(v_addition_name)
                ) THEN
                    c_additions_skipped_dup := c_additions_skipped_dup + 1;
                ELSE
                    INSERT INTO public.product_additions (
                        id,
                        restaurant_id,
                        product_id,
                        name,
                        price,
                        is_available,
                        display_order,
                        created_at,
                        updated_at
                    ) VALUES (
                        gen_random_uuid()::text,
                        v_prod_rec.restaurant_id,
                        v_prod_rec.id,
                        v_addition_name,
                        GREATEST(v_addition_price, 0.00),
                        TRUE,
                        v_display_order,
                        v_migration_started_at,
                        v_migration_started_at
                    );
                    c_additions_inserted := c_additions_inserted + 1;
                    v_display_order := v_display_order + 1;
                END IF;
            END LOOP;

        -- Caso B: Columna de tipo ARRAY (TEXT[], VARCHAR[])
        ELSIF v_col_type = 'ARRAY' THEN
            IF v_prod_rec.additions IS NULL OR CARDINALITY(v_prod_rec.additions::text[]) = 0 THEN
                c_products_empty_or_null := c_products_empty_or_null + 1;
                CONTINUE;
            END IF;

            c_products_with_additions := c_products_with_additions + 1;

            FOR v_elem_text IN
                SELECT unnest(v_prod_rec.additions::text[])
            LOOP
                IF v_elem_text IS NULL OR LENGTH(TRIM(v_elem_text)) = 0 THEN
                    c_additions_skipped_bad := c_additions_skipped_bad + 1;
                    CONTINUE;
                END IF;

                v_addition_name := TRIM(v_elem_text);
                v_addition_price := 0.00;

                -- Idempotencia: Verificar si ya existe
                IF EXISTS (
                    SELECT 1
                    FROM public.product_additions pa
                    WHERE pa.restaurant_id = v_prod_rec.restaurant_id
                      AND pa.product_id = v_prod_rec.id
                      AND LOWER(TRIM(pa.name)) = LOWER(v_addition_name)
                ) THEN
                    c_additions_skipped_dup := c_additions_skipped_dup + 1;
                ELSE
                    INSERT INTO public.product_additions (
                        id,
                        restaurant_id,
                        product_id,
                        name,
                        price,
                        is_available,
                        display_order,
                        created_at,
                        updated_at
                    ) VALUES (
                        gen_random_uuid()::text,
                        v_prod_rec.restaurant_id,
                        v_prod_rec.id,
                        v_addition_name,
                        v_addition_price,
                        TRUE,
                        v_display_order,
                        v_migration_started_at,
                        v_migration_started_at
                    );
                    c_additions_inserted := c_additions_inserted + 1;
                    v_display_order := v_display_order + 1;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- 3. Imprimir resumen de ejecución
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '📊 RESUMEN DE MIGRACIÓN:';
    RAISE NOTICE '   - Timestamp de corrida:                   %', v_migration_started_at;
    RAISE NOTICE '   - Productos evaluados en total:           %', c_products_total;
    RAISE NOTICE '   - Productos con adiciones procesadas:     %', c_products_with_additions;
    RAISE NOTICE '   - Productos con adiciones vacías o NULL:  %', c_products_empty_or_null;
    RAISE NOTICE '   - Filas INSERTADAS en product_additions:  %', c_additions_inserted;
    RAISE NOTICE '   - Filas OMITIDAS (ya existían / idemp.):  %', c_additions_skipped_dup;
    RAISE NOTICE '   - Entradas DESCARTADAS (inválidas/vacías): %', c_additions_skipped_bad;
    RAISE NOTICE '============================================================';
END $$;


-- ----------------------------------------------------------------------------
-- 4. Verificación y Auditoría Post-Migración
-- ----------------------------------------------------------------------------

-- Conteo total de adiciones por restaurante en la tabla relacional
SELECT 
    r.id            AS restaurant_id,
    r.slug          AS restaurant_slug,
    r.name          AS restaurant_name,
    COUNT(pa.id)    AS total_product_additions
FROM public.restaurants r
LEFT JOIN public.product_additions pa ON pa.restaurant_id = r.id
GROUP BY r.id, r.slug, r.name
ORDER BY r.slug;

-- Muestra de adiciones migradas vinculadas a su producto
SELECT 
    pa.restaurant_id,
    p.name          AS product_name,
    pa.name         AS addition_name,
    pa.price        AS addition_price,
    pa.is_available,
    pa.display_order,
    pa.created_at
FROM public.product_additions pa
JOIN public.products p ON p.id = pa.product_id
ORDER BY pa.restaurant_id, p.name, pa.display_order
LIMIT 25;


-- ============================================================================
-- ROLLBACK MANUAL: solo ejecutar si es necesario revertir esta migración específica
-- ============================================================================
-- DELETE FROM public.product_additions 
-- WHERE created_at >= '<pegar aquí el timestamp impreso en el resumen>';
