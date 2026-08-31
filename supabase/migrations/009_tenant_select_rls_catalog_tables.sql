-- ============================================================================
-- Migration 009 — feature/data-model-cleanup: política de SELECT tenant-scoped
-- faltante en las tablas de catálogo (categories, products, product_additions,
-- restaurant_hours)
--
-- Contexto: verificado empíricamente contra Postgres real que un UPDATE de
-- app_user que cambia is_active/is_available a false es rechazado con
-- "new row violates row-level security policy" (42501) incluso cuando
-- restaurant_id coincide y la política de escritura (migración 007) debería
-- permitirlo. Causa: Postgres exige, además del WITH CHECK de la política de
-- UPDATE, que la fila (vieja y nueva) sea visible bajo alguna política de
-- SELECT permisiva. Estas 4 tablas solo tenían la política pública de
-- storefront (public_read_*, USING (is_active/is_available = TRUE)) — una
-- fila con is_active/is_available = false nunca la satisface, así que
-- desactivar cualquier categoría/producto/adición quedaba imposible para
-- app_user. Es también un bug funcional independiente de RLS: sin esto, un
-- admin tampoco podría LEER sus propios ítems ya desactivados (ej. para
-- reactivarlos desde un panel de administración).
-- ============================================================================

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

SELECT tablename, count(*) AS n_policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('categories', 'products', 'product_additions', 'restaurant_hours')
GROUP BY tablename
ORDER BY tablename;
