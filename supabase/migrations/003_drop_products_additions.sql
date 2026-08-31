-- ============================================================================
-- Migration 003 — feature/data-model-cleanup: DROP COLUMN products.additions
-- Run in: Supabase Dashboard → SQL Editor (DO NOT RUN AUTOMATICALLY)
-- 
-- ⚠️  WARNING: Esta migración es DESTRUCTIVA e IRREVERSIBLE sin restaurar
--              desde un backup previo de PostgreSQL / Supabase.
--              Solo debe ejecutarse DESPUÉS de que la migración 002 haya
--              poblado exitosamente la tabla 'product_additions'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Verificación de Seguridad Pre-DROP
--    Ejecutar este SELECT antes del DROP. El conteo DEBE ser 0 (todas las
--    adiciones deben haber sido migradas a la tabla 'product_additions' o
--    estar vacías antes de proceder).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_col_type          TEXT;
    v_unmigrated_count  INTEGER := 0;
BEGIN
    SELECT data_type INTO v_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = 'additions';

    IF v_col_type IS NULL THEN
        RAISE NOTICE 'ℹ️  La columna "additions" ya no existe en "public.products".';
        RETURN;
    END IF;

    IF v_col_type IN ('jsonb', 'json') THEN
        SELECT COUNT(*) INTO v_unmigrated_count
        FROM public.products
        WHERE additions IS NOT NULL
          AND jsonb_typeof(additions::jsonb) = 'array'
          AND jsonb_array_length(additions::jsonb) > 0;
    ELSIF v_col_type = 'ARRAY' THEN
        SELECT COUNT(*) INTO v_unmigrated_count
        FROM public.products
        WHERE additions IS NOT NULL
          AND CARDINALITY(additions::text[]) > 0;
    ELSE
        SELECT COUNT(*) INTO v_unmigrated_count
        FROM public.products
        WHERE additions IS NOT NULL
          AND LENGTH(TRIM(additions::text)) > 2;
    END IF;

    RAISE NOTICE '============================================================';
    RAISE NOTICE '🔍 VERIFICACIÓN DE SEGURIDAD:';
    RAISE NOTICE '   - Productos con datos no vacíos en "additions": %', v_unmigrated_count;
    IF v_unmigrated_count > 0 THEN
        RAISE EXCEPTION '⚠️  ABORTADO: Existen % productos con datos en la columna additions. Ejecutá 002_migrate_product_additions.sql antes de continuar.', v_unmigrated_count;
    ELSE
        RAISE NOTICE '✅ Conteo verificado en 0. Seguro para proceder con el DROP.';
    END IF;
    RAISE NOTICE '============================================================';
END $$;


-- ----------------------------------------------------------------------------
-- 2. Eliminación física de la columna 'additions'
--    (el bloque DO $$ de arriba aborta con RAISE EXCEPTION si hay datos sin
--     migrar, lo que revierte toda la transacción de este script y nunca deja
--     llegar la ejecución hasta este ALTER TABLE)
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
    DROP COLUMN IF EXISTS additions;


-- ----------------------------------------------------------------------------
-- 3. Verificación Post-DROP
-- ----------------------------------------------------------------------------
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name   = 'products' 
  AND column_name  = 'additions';
-- Resultado esperado: 0 filas (la columna fue eliminada completamente).
