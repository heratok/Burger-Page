-- ============================================================================
-- 0000000000015_admin_audit_log.up.sql
-- Super admin audit trail (mirrors database/01_schema.sql):
--   admin_audit_log: append-only record of every super admin mutation on
--   restaurants and users. Actor and target are SNAPSHOTS (username / name) and
--   carry NO foreign keys, so the history survives deleting the user or the
--   restaurant it describes (and a hard delete of a tenant never cascades into
--   it). `details` holds changed field names and non-secret before/after
--   values; the application sanitizes credentials out before inserting.
--
-- Access: app_user can only SELECT and INSERT (no UPDATE/DELETE grant, no such
-- policy) and only as super_admin; a trigger also rejects UPDATE for any role.
--
-- Runs on LIVE data. node-pg-migrate wraps it in a transaction: any failure
-- rolls everything back and leaves the database untouched. Idempotent.
-- ============================================================================

SET LOCAL lock_timeout = '15s';

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id  TEXT,
    actor_username TEXT NOT NULL,
    action         TEXT NOT NULL,
    target_type    TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    target_label   TEXT NOT NULL DEFAULT '',
    restaurant_id  TEXT,
    details        JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_admin_audit_log_id_format
        CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
    CONSTRAINT chk_admin_audit_log_action
        CHECK (char_length(action) BETWEEN 1 AND 64),
    CONSTRAINT chk_admin_audit_log_target_type
        CHECK (target_type IN ('restaurant', 'user')),
    CONSTRAINT chk_admin_audit_log_details_object
        CHECK (jsonb_typeof(details) = 'object')
);

-- Keyset pagination of the global feed (newest first) and its filters.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
    ON public.admin_audit_log (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_restaurant
    ON public.admin_audit_log (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
    ON public.admin_audit_log (actor_user_id);

COMMENT ON TABLE public.admin_audit_log IS 'Auditoría append-only de acciones del super admin sobre restaurantes y usuarios. Sin claves foráneas: actor y objetivo son snapshots y el historial sobrevive al borrado de ambos.';
COMMENT ON COLUMN public.admin_audit_log.actor_user_id IS 'Id del usuario que actuó (sin FK: el usuario puede borrarse después). actor_username conserva el nombre.';
COMMENT ON COLUMN public.admin_audit_log.action IS 'restaurant.create|update|pause|activate|delete|restore, user.create|update|activate|deactivate|delete|reset_password.';
COMMENT ON COLUMN public.admin_audit_log.target_label IS 'Snapshot del nombre del restaurante o del username del usuario afectado al momento de la acción.';
COMMENT ON COLUMN public.admin_audit_log.restaurant_id IS 'Restaurante afectado o al que pertenece el usuario afectado (sin FK: un tenant borrado conserva su historial).';
COMMENT ON COLUMN public.admin_audit_log.details IS 'Nombres de campos cambiados y valores antes/después no secretos. Nunca contraseñas, hashes ni credenciales temporales.';

-- Append-only: no UPDATE/DELETE for app_user (the REVOKE also covers the
-- default privileges that grant everything on new tables), and a trigger
-- rejects UPDATE for any other role too.
GRANT SELECT, INSERT ON public.admin_audit_log TO app_user;
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM app_user;

CREATE OR REPLACE FUNCTION public.guard_admin_audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_log is append-only: rows cannot be updated'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_immutable
    BEFORE UPDATE ON public.admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.guard_admin_audit_log_immutable();

-- RLS: platform data, not tenant data. Only a super_admin session may read or
-- append; tenant sessions and the anonymous role see nothing.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "super_admin_read_admin_audit_log" ON public.admin_audit_log
    FOR SELECT
    USING ((SELECT public.app_is_super_admin()));

DROP POLICY IF EXISTS "super_admin_append_admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "super_admin_append_admin_audit_log" ON public.admin_audit_log
    FOR INSERT
    WITH CHECK ((SELECT public.app_is_super_admin()));
