import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dbDir = resolve(__dirname, '../../../database');
const read = (rel: string) => readFileSync(resolve(dbDir, rel), 'utf8');

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const rest = sql.slice(start);
  const close = rest.match(/\n\s*\$\$;/);
  if (!close || close.index === undefined) throw new Error(`function ${name} is not terminated`);
  // Compare bodies, not indentation: the baseline nests this function.
  return rest
    .slice(0, close.index)
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

describe('migration 0000000000017 (roles and staff users) parity with the baseline schema', () => {
  const baseline = read('01_schema.sql');
  const up = read('migrations/0000000000017_roles_and_staff.up.sql');
  const down = read('migrations/0000000000017_roles_and_staff.down.sql');
  const flat = (sql: string) => sql.replace(/\s+/g, ' ');
  const tableBody = (sql: string, table: string) =>
    sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`))![1];

  describe('roles table', () => {
    it('baseline and up declare the same table definition', () => {
      expect(flat(tableBody(up, 'roles'))).toBe(flat(tableBody(baseline, 'roles')));
    });

    it('is tenant-owned with name/id CHECKs, tenant-scoped uniqueness and a composite FK target', () => {
      const body = flat(tableBody(baseline, 'roles'));
      expect(body).toContain('restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE');
      expect(body).toContain("CONSTRAINT chk_roles_id_format CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')");
      expect(body).toContain('CHECK (char_length(btrim(name)) BETWEEN 1 AND 40)');
      expect(body).toContain('permissions TEXT[] NOT NULL DEFAULT');
      expect(body).toContain('CONSTRAINT uq_roles_id_restaurant UNIQUE (id, restaurant_id)');
      for (const sql of [baseline, up]) {
        expect(flat(sql)).toContain('uq_roles_name');
        expect(flat(sql)).toContain('(restaurant_id, lower(btrim(name)))');
      }
    });

    it('enables and forces RLS with tenant isolation only, grants app_user, keeps updated_at fresh', () => {
      for (const sql of [baseline, up]) {
        expect(flat(sql)).toContain('ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('ALTER TABLE public.roles FORCE ROW LEVEL SECURITY');
        expect(flat(sql)).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO app_user');
        expect(flat(sql)).toContain('CREATE POLICY "tenant_isolation_roles" ON public.roles FOR ALL');
        expect(flat(sql)).toContain(
          'USING ((restaurant_id = (SELECT public.app_current_restaurant_id())) OR (SELECT public.app_is_super_admin()))'
        );
        expect(flat(sql)).toContain('trg_roles_updated_at');
      }
    });
  });

  describe('users.role_id and the restaurant_staff role', () => {
    it('declares the nullable role_id column and the tenant-scoped FK in both places', () => {
      const body = flat(tableBody(baseline, 'users'));
      expect(body).toContain('role_id TEXT,');
      expect(body).toContain(
        'CONSTRAINT fk_users_role_tenant FOREIGN KEY (role_id, restaurant_id) REFERENCES public.roles(id, restaurant_id) ON DELETE NO ACTION'
      );
      expect(flat(up)).toContain('ADD COLUMN IF NOT EXISTS role_id TEXT');
      expect(flat(up)).toContain(
        'FOREIGN KEY (role_id, restaurant_id) REFERENCES public.roles(id, restaurant_id) ON DELETE NO ACTION'
      );
      expect(up).toContain("conname = 'fk_users_role_tenant'");
    });

    it('extends the role CHECK with restaurant_staff in both places', () => {
      const body = flat(tableBody(baseline, 'users'));
      expect(body).toContain("CONSTRAINT chk_users_role CHECK (role IN ('super_admin', 'restaurant_admin', 'restaurant_staff'))");
      expect(flat(up)).toContain("ADD CONSTRAINT chk_users_role CHECK (role IN ('super_admin', 'restaurant_admin', 'restaurant_staff'))");
      expect(up).toContain('DROP CONSTRAINT IF EXISTS users_role_check');
    });

    it('binds both tenant roles to a restaurant and ties role_id to the staff role', () => {
      const body = flat(tableBody(baseline, 'users'));
      const adminChk =
        "CHECK (role NOT IN ('restaurant_admin', 'restaurant_staff') OR restaurant_id IS NOT NULL)";
      const staffChk = "CHECK ((role = 'restaurant_staff') = (role_id IS NOT NULL))";
      expect(body).toContain(`CONSTRAINT chk_restaurant_admin_has_restaurant ${adminChk}`);
      expect(body).toContain(`CONSTRAINT chk_users_role_id_matches_role ${staffChk}`);
      expect(flat(up)).toContain(`ADD CONSTRAINT chk_restaurant_admin_has_restaurant ${adminChk}`);
      expect(flat(up)).toContain(`ADD CONSTRAINT chk_users_role_id_matches_role ${staffChk}`);
    });

    it('defines the privilege guard identically in baseline and up and blocks staff from changing role_id', () => {
      const fn = extractFunction(baseline, 'guard_users_privilege_change');
      expect(extractFunction(up, 'guard_users_privilege_change')).toBe(fn);
      expect(fn).toContain('NEW.role_id IS DISTINCT FROM OLD.role_id');
      expect(fn).toContain("'restaurant_staff'");
      expect(fn).toContain("ERRCODE = '42501'");
    });
  });

  describe('admin audit log', () => {
    it('accepts role as a target type in baseline and up', () => {
      const check = "CHECK (target_type IN ('restaurant', 'user', 'role'))";
      expect(flat(tableBody(baseline, 'admin_audit_log'))).toContain(check);
      expect(flat(up)).toContain(check);
    });
  });

  describe('reversibility', () => {
    it('down restores the previous guard and constraints and drops the new objects', () => {
      expect(down).toContain('DROP CONSTRAINT IF EXISTS fk_users_role_tenant');
      expect(down).toContain('DROP COLUMN IF EXISTS role_id');
      expect(down).toContain('DROP CONSTRAINT IF EXISTS chk_users_role_id_matches_role');
      expect(down).toContain('DROP TABLE IF EXISTS public.roles');
      expect(flat(down)).toContain("CHECK (role IN ('super_admin', 'restaurant_admin'))");
      expect(flat(down)).toContain("CHECK (role != 'restaurant_admin' OR restaurant_id IS NOT NULL)");
      expect(extractFunction(down, 'guard_users_privilege_change')).not.toContain('role_id');
    });

    it('down refuses to run while staff users exist', () => {
      expect(down).toMatch(/RAISE EXCEPTION[\s\S]*restaurant_staff/);
    });
  });
});
