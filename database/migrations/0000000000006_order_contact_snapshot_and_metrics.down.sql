-- ============================================================================
-- 0000000000006_order_contact_snapshot_and_metrics.down.sql
-- Reversa de WU-4: restaura el cuerpo de update_customer_order_metrics vigente
-- tras 0000000000004 (recomputa solo COALESCE(NEW.customer_id, OLD.customer_id))
-- y elimina el snapshot de contacto de orders. Los datos del snapshot se
-- descartan (customers conserva el perfil; el snapshot es derivado/histórico).
-- Idempotente: DROP COLUMN IF EXISTS + CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_customer_order_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
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
    -- disparadora (fuente OLD/NEW según operación, igual que v_customer_id)
    -- para que las ventas de un tenant jamás recomputen los totales de un
    -- customer de otro tenant, aunque hubiera entrado un link cross-tenant
    -- antes del fix de FKs compuestos.
    IF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
        v_restaurant_id := OLD.restaurant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
        v_restaurant_id := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
    ELSE
        v_customer_id := NEW.customer_id;
        v_restaurant_id := NEW.restaurant_id;
    END IF;
    IF v_customer_id IS NULL THEN
        RETURN NEW;
    END IF;

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

    RETURN NEW;
END;
$$;

ALTER TABLE public.orders
    DROP COLUMN IF EXISTS contact_name,
    DROP COLUMN IF EXISTS contact_phone,
    DROP COLUMN IF EXISTS contact_address,
    DROP COLUMN IF EXISTS contact_barrio;
