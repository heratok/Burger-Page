-- ============================================================================
-- Migration 004 — feature/data-model-cleanup: revoke public EXECUTE on
-- SECURITY DEFINER order-mutation RPCs
--
-- Contexto: create_order_atomic y update_order_status_with_actor son
-- SECURITY DEFINER (bypassean RLS) y hoy tienen GRANT EXECUTE para los roles
-- 'anon' y 'authenticated'. Como ninguno de los dos valida que el llamador
-- esté autorizado a actuar en nombre de p_restaurant_id (solo validan que las
-- entidades referenciadas -productos, clientes, adiciones- pertenezcan a ese
-- restaurante), cualquiera con la anon key puede invocar
-- /rest/v1/rpc/create_order_atomic o /rest/v1/rpc/update_order_status_with_actor
-- pasando el restaurant_id que quiera y crear/mutar pedidos de cualquier
-- restaurante. El backend (único llamador legítimo) usa SUPABASE_SERVICE_ROLE_KEY,
-- así que revocar 'anon'/'authenticated' no afecta ninguna funcionalidad real.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
    p_order_id text,
    p_restaurant_id text,
    p_customer_id text,
    p_payment_method text,
    p_payment_amount numeric,
    p_change_amount numeric,
    p_comment text,
    p_items jsonb
) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_order_status_with_actor(
    p_order_id text,
    p_new_status text,
    p_restaurant_id text,
    p_actor text
) FROM anon, authenticated;

-- Verificación post-revoke: debe devolver 0 filas (ni anon ni authenticated
-- deben figurar como grantees de estas dos funciones).
SELECT p.proname, r.rolname AS grantee
FROM pg_proc p
JOIN LATERAL (SELECT (aclexplode(p.proacl)).grantee AS grantee_oid) g ON true
JOIN pg_roles r ON r.oid = g.grantee_oid
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('create_order_atomic', 'update_order_status_with_actor')
  AND r.rolname IN ('anon', 'authenticated');
