-- ============================================================================
-- 0000000000006_order_contact_snapshot_and_metrics.up.sql
-- WU-4 (functional-flow-fixes):
--   4.3 orders gana un snapshot de contacto (contact_name/phone/address/barrio)
--       escrito al crear/editar el pedido; la lectura prefiere el snapshot y cae
--       a customers. Así un pedido anónimo de un teléfono conocido muestra la
--       dirección dada en ESE pedido y no la del perfil CRM, y los datos de
--       contacto ya no se pierden si el cliente no se pudo vincular.
--   4.4 update_customer_order_metrics recomputa TANTO el cliente anterior como
--       el nuevo cuando orders.customer_id cambia (A -> B / A -> NULL).
--
-- Safe on live data:
--   * Columnas nuevas NULLABLE, sin default: ADD COLUMN IF NOT EXISTS es solo
--     metadata en PG11+ (sin reescritura de tabla) y es idempotente.
--   * Backfill idempotente (solo filas con contact_name IS NULL y customer_id no
--     nulo). Corre como super_admin de la sesión (set_config local a la
--     transacción) porque orders/customers tienen FORCE ROW LEVEL SECURITY, y
--     con trg_orders_updated_at deshabilitado para no alterar updated_at de los
--     pedidos históricos. El trigger de métricas no se dispara (solo escucha
--     UPDATE OF status, final_total, customer_id).
--   * El trigger se redefine con CREATE OR REPLACE (misma firma).
-- El cuerpo de la función es byte-idéntico a database/01_schema.sql sección 3.3.
-- ============================================================================

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS contact_name    TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone   TEXT,
    ADD COLUMN IF NOT EXISTS contact_address TEXT,
    ADD COLUMN IF NOT EXISTS contact_barrio  TEXT;

DO $backfill$
BEGIN
    PERFORM set_config('app.actor_role', 'super_admin', true);

    ALTER TABLE public.orders DISABLE TRIGGER trg_orders_updated_at;

    UPDATE public.orders o
    SET contact_name    = c.name,
        contact_phone   = c.phone,
        contact_address = NULLIF(c.address, ''),
        contact_barrio  = NULLIF(c.barrio, '')
    FROM public.customers c
    WHERE o.customer_id = c.id
      AND o.restaurant_id = c.restaurant_id
      AND o.contact_name IS NULL;

    ALTER TABLE public.orders ENABLE TRIGGER trg_orders_updated_at;
END
$backfill$;

CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_ids TEXT[];
    v_customer_id TEXT;
    v_restaurant_id TEXT;
    v_total_orders INTEGER;
    v_total_spent NUMERIC(12, 2);
    v_last_order_date TIMESTAMPTZ;
BEGIN
    -- NEW is an unassigned record in DELETE triggers: pick the row
    -- source by operation before touching any column (previously this
    -- COALESCE ran unconditionally and every DELETE on public.orders
    -- raised 'record "new" is not assigned yet').
    -- WU-1b (M2/M3): el agregado se filtra por el restaurante de la orden
    -- disparadora (fuente OLD/NEW según operación, igual que los customer ids)
    -- para que las ventas de un tenant jamás recomputen los totales de un
    -- customer de otro tenant, aunque hubiera entrado un link cross-tenant
    -- antes del fix de FKs compuestos.
    -- WU-4 (4.4): cuando customer_id cambia A -> B (o A -> NULL) se recomputan
    -- AMBOS clientes; antes solo se recomputaba COALESCE(NEW, OLD) y el
    -- cliente anterior conservaba totales obsoletos.
    IF TG_OP = 'DELETE' THEN
        v_customer_ids := ARRAY[OLD.customer_id];
        v_restaurant_id := OLD.restaurant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_ids := ARRAY[NEW.customer_id, OLD.customer_id];
        v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
    ELSE
        v_customer_ids := ARRAY[NEW.customer_id];
        v_restaurant_id := NEW.restaurant_id;
    END IF;

    FOR v_customer_id IN
        SELECT DISTINCT c FROM unnest(v_customer_ids) AS c WHERE c IS NOT NULL
    LOOP
        SELECT
            COUNT(*),
            COALESCE(SUM(final_total), 0.00),
            MAX(created_at)
        INTO
            v_total_orders,
            v_total_spent,
            v_last_order_date
        FROM public.orders
        WHERE customer_id = v_customer_id
          AND restaurant_id = v_restaurant_id
          AND status != 'cancelled';

        UPDATE public.customers
        SET
            total_orders = v_total_orders,
            total_spent = v_total_spent,
            last_order_date = v_last_order_date,
            updated_at = NOW()
        WHERE id = v_customer_id
          AND restaurant_id = v_restaurant_id;
    END LOOP;

    RETURN NEW;
END;
$$;
