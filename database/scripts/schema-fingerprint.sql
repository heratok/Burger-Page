-- ============================================================================
-- schema-fingerprint.sql
-- Prints a deterministic, order-independent description of the `public`
-- schema, one block per catalog object, sorted by a stable key. Two databases
-- with the same fingerprint have the same tables, columns, constraints,
-- indexes, functions (full definition + ACL), triggers, RLS flags, policies
-- and privileges. Used by database/scripts/check-migration-drift.sh:
--
--   psql -X -A -t -q -v ON_ERROR_STOP=1 -f schema-fingerprint.sql <db-url>
--
-- Deliberately ignored (noise): comments, column ORDER (migrations append
-- columns, the baseline declares them in place), object owners, the
-- node-pg-migrate table `pgmigrations`, dropped columns and the ORDER of
-- aclitems inside an ACL (they are sorted here).
-- ============================================================================
WITH tables AS (
    SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> 'pgmigrations'
),
items(sort_key, body) AS (
    -- Tables: RLS flags and privileges.
    SELECT '1 table ' || t.relname,
           'table ' || t.relname
           || ' rls=' || t.relrowsecurity
           || ' force_rls=' || t.relforcerowsecurity
           || ' acl=' || COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(t.relacl) AS x), 'default')
    FROM tables t

    UNION ALL
    -- Columns (sorted by name, not by position).
    SELECT '2 column ' || t.relname || '.' || a.attname,
           'column ' || t.relname || '.' || a.attname
           || ' ' || format_type(a.atttypid, a.atttypmod)
           || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
           || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
           || CASE WHEN a.attgenerated <> '' THEN ' GENERATED' ELSE '' END
    FROM tables t
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum

    UNION ALL
    -- Constraints (PK, UNIQUE, CHECK, FK incl. NOT VALID state and ON DELETE).
    SELECT '3 constraint ' || t.relname || '.' || co.conname,
           'constraint ' || t.relname || '.' || co.conname || ' ' || pg_get_constraintdef(co.oid)
    FROM tables t
    JOIN pg_constraint co ON co.conrelid = t.oid
    WHERE co.contype <> 'n'

    UNION ALL
    -- Indexes.
    SELECT '4 index ' || i.indexname,
           'index ' || i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename <> 'pgmigrations'

    UNION ALL
    -- Triggers.
    SELECT '5 trigger ' || t.relname || '.' || tg.tgname,
           'trigger ' || pg_get_triggerdef(tg.oid)
    FROM tables t
    JOIN pg_trigger tg ON tg.tgrelid = t.oid
    WHERE NOT tg.tgisinternal

    UNION ALL
    -- RLS policies.
    SELECT '6 policy ' || p.tablename || '.' || p.policyname,
           'policy ' || p.tablename || '.' || p.policyname
           || ' cmd=' || p.cmd
           || ' permissive=' || p.permissive
           || ' roles=' || p.roles::text
           || ' using=' || COALESCE(p.qual, '')
           || ' check=' || COALESCE(p.with_check, '')
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename <> 'pgmigrations'

    UNION ALL
    -- Functions: identity signature, full definition (body, SECURITY DEFINER,
    -- search_path) and EXECUTE privileges.
    SELECT '7 function ' || p.oid::regprocedure::text,
           'function ' || p.oid::regprocedure::text
           || E'\nacl=' || COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(p.proacl) AS x), 'default')
           || E'\n' || pg_get_functiondef(p.oid)
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
          SELECT 1 FROM pg_depend dep
          WHERE dep.classid = 'pg_proc'::regclass
            AND dep.objid = p.oid
            AND dep.deptype = 'e'
      )

    UNION ALL
    -- Default privileges granted in schema public.
    SELECT '8 defacl ' || da.defaclrole::regrole::text || ' ' || da.defaclobjtype::text,
           'defacl ' || da.defaclrole::regrole::text || ' ' || da.defaclobjtype::text
           || ' ' || COALESCE((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(da.defaclacl) AS x), '')
    FROM pg_default_acl da
    WHERE da.defaclnamespace = 'public'::regnamespace
)
SELECT body FROM items ORDER BY sort_key COLLATE "C", body COLLATE "C";
