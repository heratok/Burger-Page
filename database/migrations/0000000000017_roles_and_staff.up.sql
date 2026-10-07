-- ============================================================================
-- 0000000000017_roles_and_staff.up.sql
-- Custom per-restaurant roles and staff users (mirrors database/01_schema.sql):
--   R1  roles: a named set of permissions a restaurant admin defines (the
--       permission catalog lives in code; roles are data). Tenant-scoped RLS.
--   R2  users.role_id + the 'restaurant_staff' role: staff are tenant-bound,
--       must hold a role of their OWN restaurant (composite FK), and a role
--       that still has users cannot be deleted (NO ACTION is checked at the end
--       of the statement, so deleting a whole restaurant still cascades).
--   R3  guard_users_privilege_change(): staff sessions may not reassign roles.
--   R4  admin_audit_log.target_type accepts 'role'.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

-- ── R1. roles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    permissions   TEXT[] NOT NULL DEFAULT '{}',
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_roles_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_roles_name
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    CONSTRAINT chk_roles_permissions_no_nulls
        CHECK (array_position(permissions, NULL) IS NULL),
    CONSTRAINT uq_roles_id_restaurant
        UNIQUE (id, restaurant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_name
    ON public.roles (restaurant_id, lower(btrim(name)));

COMMENT ON TABLE public.roles IS 'Roles personalizados de un restaurante: conjunto de permisos (catálogo en código) que el admin asigna a usuarios restaurant_staff. Se borra en cascada con el restaurante; un rol en uso no se puede borrar.';
COMMENT ON COLUMN public.roles.name IS 'Nombre visible; único por restaurante sin distinguir mayúsculas.';
COMMENT ON COLUMN public.roles.permissions IS 'Permisos concedidos (p. ej. orders.view). El catálogo se valida en la aplicación.';
COMMENT ON COLUMN public.roles.is_system IS 'true = rol creado por el sistema; no editable ni borrable desde el panel.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO app_user;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_roles" ON public.roles;
CREATE POLICY "tenant_isolation_roles" ON public.roles
    FOR ALL
    USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))
    WITH CHECK ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()));

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── R2. users.role_id and the restaurant_staff role ─────────────────────────
-- Nullable, no default: metadata-only change, existing users keep NULL.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS role_id TEXT;

COMMENT ON TABLE public.users IS 'Empleados/administradores. rol super_admin es de plataforma (restaurant_id NULL); restaurant_staff exige role_id.';
COMMENT ON COLUMN public.users.role_id IS 'Rol personalizado (roles) de un usuario restaurant_staff; NULL para super_admin y restaurant_admin. El rol debe ser del mismo restaurante y no se puede borrar mientras haya usuarios que lo usen.';

-- The inline column CHECK of the baseline is auto-named users_role_check.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE public.users
    ADD CONSTRAINT chk_users_role
    CHECK (role IN ('super_admin', 'restaurant_admin', 'restaurant_staff'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_restaurant_admin_has_restaurant;
ALTER TABLE public.users
    ADD CONSTRAINT chk_restaurant_admin_has_restaurant
    CHECK (role NOT IN ('restaurant_admin', 'restaurant_staff') OR restaurant_id IS NOT NULL);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role_id_matches_role;
ALTER TABLE public.users
    ADD CONSTRAINT chk_users_role_id_matches_role
    CHECK ((role = 'restaurant_staff') = (role_id IS NOT NULL));

-- The role must belong to the same restaurant as the user. A NULL role_id
-- (admins, super_admin) skips the check (MATCH SIMPLE).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_users_role_tenant'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT fk_users_role_tenant
            FOREIGN KEY (role_id, restaurant_id)
            REFERENCES public.roles(id, restaurant_id)
            ON DELETE NO ACTION;
    END IF;
END
$$;

-- ── R3. privilege guard ─────────────────────────────────────────────────────
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
            -- Staff may never reassign roles (their own included): only an
            -- admin session may change which custom role a user holds.
            IF NEW.role_id IS DISTINCT FROM OLD.role_id
               AND (SELECT NULLIF(current_setting('app.actor_role'::text, true), '')) = 'restaurant_staff'::text THEN
                RAISE EXCEPTION USING ERRCODE = '42501',
                    MESSAGE = 'Staff users may not change a user''s custom role';
            END IF;
            RETURN NEW;
        END;
        $$;

-- ── R4. admin audit log target type ─────────────────────────────────────────
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS chk_admin_audit_log_target_type;
ALTER TABLE public.admin_audit_log
    ADD CONSTRAINT chk_admin_audit_log_target_type
    CHECK (target_type IN ('restaurant', 'user', 'role'));
