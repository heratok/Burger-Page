-- ============================================================================
-- Migration 008 — feature/data-model-cleanup: permitir a app_user ejecutar
-- las RPC de negocio (create_order_atomic, update_order_status_with_actor,
-- adjust_inventory_stock)
--
-- Contexto: estas 3 funciones son SECURITY DEFINER (corren con privilegios
-- del owner, bypassean RLS internamente) y hasta ahora solo estaban
-- GRANT-eadas a service_role/postgres. El nuevo adaptador Pg*Repository
-- (backend/src/infrastructure/persistence/postgres/) reusa esta lógica ya
-- validada en vez de reimplementarla en TypeScript — cada función ya valida
-- puntualmente que las entidades referenciadas (producto, cliente, adición,
-- actor) pertenezcan al restaurant_id recibido, así que exponerlas a
-- app_user no relaja ninguna garantía: app_user solo se invoca desde el
-- backend con un restaurant_id ya resuelto y autenticado, mismo modelo de
-- confianza que hoy tiene service_role.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO app_user;
GRANT EXECUTE ON FUNCTION public.update_order_status_with_actor(TEXT, TEXT, TEXT, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT, TEXT, NUMERIC) TO app_user;
