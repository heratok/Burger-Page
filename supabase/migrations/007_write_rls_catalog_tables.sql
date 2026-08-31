-- ============================================================================
-- Migration 007 — feature/data-model-cleanup: políticas RLS de escritura
-- faltantes en las tablas de catálogo
--
-- Contexto: la migración 006 agregó políticas de escritura tenant-scoped a
-- las tablas transaccionales (orders, customers, etc.) y a restaurants, pero
-- se salteó las 4 tablas de catálogo que ya tenían RLS habilitado desde antes
-- con SOLO política de lectura pública (public_read_*): categories, products,
-- product_additions, restaurant_hours. Sin política de escritura, cualquier
-- INSERT/UPDATE/DELETE de app_user contra estas tablas es rechazado por RLS
-- (detectado empíricamente al probar PgCategoryRepository contra Postgres
-- real: "new row violates row-level security policy for table categories").
-- ============================================================================

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

-- restaurant_hours no tiene su propia PK de negocio expuesta al dominio; se
-- gobierna 1:1 por restaurant_id.
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

-- Verificación: las 4 tablas deben pasar de 1 política (solo lectura) a 4.
SELECT tablename, count(*) AS n_policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('categories', 'products', 'product_additions', 'restaurant_hours')
GROUP BY tablename
ORDER BY tablename;
