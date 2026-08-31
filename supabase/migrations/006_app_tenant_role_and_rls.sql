-- ============================================================================
-- Migration 006 — feature/data-model-cleanup: rol de aplicación + políticas
-- RLS de escritura scoped por restaurant_id
--
-- Contexto: hoy el backend conecta con SUPABASE_SERVICE_ROLE_KEY (BYPASSRLS),
-- así que el aislamiento multi-tenant depende 100% de que cada repo filtre
-- restaurant_id a mano. Este cambio agrega un segundo camino de conexión —
-- un rol de Postgres sin BYPASSRLS que el backend usará vía 'pg' (no más
-- PostgREST/supabase-js para las tablas de negocio) fijando dos GUCs de
-- sesión por transacción con SET LOCAL, mismo patrón que ya usan con
-- 'app.actor' para auditoría:
--   - app.restaurant_id: tenant activo de la operación
--   - app.actor_role:    'super_admin' | 'restaurant_admin' (permite
--                         operaciones legítimas cross-tenant de super-admin,
--                         ej. crear un restaurante nuevo)
-- Es 100% Postgres estándar (nada de auth.uid()/auth.jwt() de Supabase), así
-- que sobrevive intacta una futura migración fuera de Supabase.
--
-- IMPORTANTE — password del rol: este script NO fija el password de
-- app_user (no se commitea ningún secreto). Después de aplicar esta
-- migración, ejecutar a mano UNA VEZ:
--   ALTER ROLE app_user WITH PASSWORD '<password-fuerte-generado>';
-- y guardar ese password en el secret manager / .env del backend como parte
-- de DATABASE_URL (nunca en el repo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rol de aplicación (sin BYPASSRLS, sin superusuario)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.restaurants,
    public.restaurant_hours,
    public.users,
    public.categories,
    public.products,
    public.product_additions,
    public.customers,
    public.restaurant_order_counters,
    public.orders,
    public.order_status_history,
    public.order_items,
    public.order_item_additions,
    public.suppliers,
    public.inventory_items
TO app_user;

-- ----------------------------------------------------------------------------
-- 2. Políticas RLS de escritura, tablas de negocio tenant-scoped
--    (FORCE para que ni siquiera el owner de la tabla quede exento — defensa
--    en profundidad, aunque app_user nunca es owner).
-- ----------------------------------------------------------------------------
ALTER TABLE public.customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_additions    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_customers" ON public.customers
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_orders" ON public.orders
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_items" ON public.order_items
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_item_additions" ON public.order_item_additions
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_order_status_history" ON public.order_status_history
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_suppliers" ON public.suppliers
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_inventory_items" ON public.inventory_items
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_restaurant_order_counters" ON public.restaurant_order_counters
    FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- ----------------------------------------------------------------------------
-- 3. restaurants: agregar política de escritura (las 5 políticas de lectura
--    pública existentes -incluida la de esta tabla- quedan intactas). No se
--    aplica FORCE acá porque las políticas de lectura pública ya deben seguir
--    funcionando para app_user también vía la política de SELECT existente;
--    FORCE + esta política adicional solo gobierna escritura.
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_restaurants_write" ON public.restaurants
    FOR ALL
    USING (id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- ----------------------------------------------------------------------------
-- 4. users: caso especial. AuthenticateUserUseCase.findByUsername necesita
--    resolver el usuario ANTES de conocer restaurant_id (login es la única
--    operación legítimamente pre-tenant-context). app_user nunca se expone a
--    clientes externos -vive solo en el backend, mismo modelo de confianza
--    que hoy tiene service_role- así que un SELECT sin scoping es aceptable;
--    la escritura sí queda scoped al tenant (o a super_admin).
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_select_for_auth" ON public.users
    FOR SELECT
    USING (true);

CREATE POLICY "tenant_isolation_users_write" ON public.users
    FOR INSERT
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_users_update" ON public.users
    FOR UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin')
    WITH CHECK (restaurant_id = current_setting('app.restaurant_id', true) OR restaurant_id IS NULL OR current_setting('app.actor_role', true) = 'super_admin');

CREATE POLICY "tenant_isolation_users_delete" ON public.users
    FOR DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true) OR current_setting('app.actor_role', true) = 'super_admin');

-- ----------------------------------------------------------------------------
-- 5. Verificación post-migración
-- ----------------------------------------------------------------------------
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
