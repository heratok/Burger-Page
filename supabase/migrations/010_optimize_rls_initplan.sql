-- ============================================================================
-- Migration 010 — feature/data-model-cleanup: optimizar las 28 políticas RLS
-- tenant-scoped envolviendo current_setting() en (select ...)
--
-- Contexto: el performance advisor de Supabase (auth_rls_initplan) reportó
-- que las 28 políticas creadas en las migraciones 006-009 reevalúan
-- current_setting('app.restaurant_id'/'app.actor_role', true) por CADA FILA
-- en vez de una sola vez por query, porque Postgres no puede cachear una
-- llamada a función "desnuda" dentro de USING/WITH CHECK como InitPlan.
-- Envolviéndola en (select current_setting(...)) el planner sí la trata como
-- InitPlan (una sola evaluación por query), que es la recomendación oficial
-- de Supabase/Postgres para RLS a escala. Sin cambio de semántica: mismo
-- predicado, mismo resultado, solo mejor plan de ejecución.
-- ============================================================================

DROP POLICY IF EXISTS "tenant_isolation_categories_delete" ON public.categories;
CREATE POLICY "tenant_isolation_categories_delete" ON public.categories
    FOR DELETE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_select" ON public.categories;
CREATE POLICY "tenant_isolation_categories_select" ON public.categories
    FOR SELECT
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_update" ON public.categories;
CREATE POLICY "tenant_isolation_categories_update" ON public.categories
    FOR UPDATE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_categories_write" ON public.categories;
CREATE POLICY "tenant_isolation_categories_write" ON public.categories
    FOR INSERT
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_customers" ON public.customers;
CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_inventory_items" ON public.inventory_items;
CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_item_additions" ON public.order_item_additions;
CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_items" ON public.order_items;
CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_order_status_history" ON public.order_status_history;
CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_orders" ON public.orders;
CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_delete" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_delete" ON public.product_additions
    FOR DELETE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_select" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_select" ON public.product_additions
    FOR SELECT
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_update" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_update" ON public.product_additions
    FOR UPDATE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_product_additions_write" ON public.product_additions;
CREATE POLICY "tenant_isolation_product_additions_write" ON public.product_additions
    FOR INSERT
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_delete" ON public.products;
CREATE POLICY "tenant_isolation_products_delete" ON public.products
    FOR DELETE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_select" ON public.products;
CREATE POLICY "tenant_isolation_products_select" ON public.products
    FOR SELECT
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_update" ON public.products;
CREATE POLICY "tenant_isolation_products_update" ON public.products
    FOR UPDATE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_products_write" ON public.products;
CREATE POLICY "tenant_isolation_products_write" ON public.products
    FOR INSERT
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_delete" ON public.restaurant_hours
    FOR DELETE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_select" ON public.restaurant_hours
    FOR SELECT
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_update" ON public.restaurant_hours
    FOR UPDATE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours;
CREATE POLICY "tenant_isolation_restaurant_hours_write" ON public.restaurant_hours
    FOR INSERT
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters;
CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_restaurants_write" ON public.restaurants;
CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING ((id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_users_delete" ON public.users;
CREATE POLICY "tenant_isolation_users_delete" ON public.users
    FOR DELETE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_users_update" ON public.users;
CREATE POLICY "tenant_isolation_users_update" ON public.users
    FOR UPDATE
    USING ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (restaurant_id IS NULL) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text))
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (restaurant_id IS NULL) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

DROP POLICY IF EXISTS "tenant_isolation_users_write" ON public.users;
CREATE POLICY "tenant_isolation_users_write" ON public.users
    FOR INSERT
    WITH CHECK ((restaurant_id = ( select current_setting('app.restaurant_id'::text, true) )) OR (restaurant_id IS NULL) OR (( select current_setting('app.actor_role'::text, true) ) = 'super_admin'::text));

-- Verificación: sigue habiendo 24 políticas tenant_isolation_* con el mismo
-- comportamiento, solo con current_setting() envuelto en (select ...).
SELECT count(*) AS n_tenant_policies FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'tenant_isolation_%';
