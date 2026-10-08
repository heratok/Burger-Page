-- ============================================================================
-- 0000000000017_roles_and_staff.down.sql
-- Restores the 0016 state. Refuses to run while restaurant_staff users exist:
-- they cannot be represented without the role (delete or convert them first).
-- Audit rows that target a role are kept, so the restored target_type CHECK is
-- added NOT VALID (history is append-only and must not be rewritten).
-- ============================================================================

SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE role = 'restaurant_staff') THEN
        RAISE EXCEPTION '0017 down aborted: restaurant_staff users still exist. Delete them or convert them to restaurant_admin first.';
    END IF;
END
$$;

ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS chk_admin_audit_log_target_type;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.admin_audit_log WHERE target_type = 'role') THEN
        ALTER TABLE public.admin_audit_log
            ADD CONSTRAINT chk_admin_audit_log_target_type
            CHECK (target_type IN ('restaurant', 'user')) NOT VALID;
    ELSE
        ALTER TABLE public.admin_audit_log
            ADD CONSTRAINT chk_admin_audit_log_target_type
            CHECK (target_type IN ('restaurant', 'user'));
    END IF;
END
$$;

        CREATE OR REPLACE FUNCTION public.guard_users_privilege_change()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = public, pg_temp
        AS $$
        BEGIN
            IF NEW.role IS DISTINCT FROM OLD.role
               OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id THEN
                IF (SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) IS DISTINCT FROM 'super_admin'::text THEN
                    RAISE EXCEPTION USING ERRCODE = '42501',
                        MESSAGE = 'Only super_admin may change a user''s role or restaurant';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_role_tenant;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role_id_matches_role;
ALTER TABLE public.users DROP COLUMN IF EXISTS role_id;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_restaurant_admin_has_restaurant;
ALTER TABLE public.users
    ADD CONSTRAINT chk_restaurant_admin_has_restaurant
    CHECK (role != 'restaurant_admin' OR restaurant_id IS NOT NULL);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'restaurant_admin'));

COMMENT ON TABLE public.users IS 'Empleados/administradores. rol super_admin es de plataforma (restaurant_id NULL).';

DROP TABLE IF EXISTS public.roles;
