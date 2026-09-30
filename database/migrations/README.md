# Migraciones versionadas (node-pg-migrate)

Las migraciones incrementales de la base de datos viven en este directorio,
gestionadas con [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate)
(SQL files). El esquema canónico completo sigue siendo `database/01_schema.sql`
(baseline): lo aplican `docker-entrypoint-initdb.d` (docker-compose), CI y el
test de idempotencia `PostgresConstraints.test.ts`.

## Flujo de trabajo

1. **Base nueva**: aplicar el baseline una sola vez (manual o initdb):
   ```bash
   psql -U postgres -d burger_page -f database/01_schema.sql
   # opcional: datos demo
   psql -U postgres -d burger_page -f database/02_seed.sql
   ```
   > ⚠️ Si el baseline ya incluye migraciones que existen como archivos en
   > `migrations/` (p.ej. `0001_...restaurant_settings_branding.sql`), estamparlas
   > como aplicadas para que no se reintenten:
   > ```bash
   > npm run db:baseline   # marca los archivos de migrations/ como ya aplicados
   > ```
2. **Crear una migración incremental** (siempre SQL en blanco):
   ```bash
   npm run db:migrate:create -- nombre_descriptivo
   # crea database/migrations/NNNN_nombre_descriptivo.sql
   ```
3. **Aplicar pendientes** (usa `DATABASE_URL` de `backend/.env` o la env var):
   ```bash
   npm run db:migrate
   ```
4. **Revertir la última** (una por ejecución; requiere `psql` en el PATH):
   ```bash
   npm run db:migrate:down   # database/scripts/migrate-down.sh
   ```

`node-pg-migrate` crea su tabla de control (`pgmigrations`) en la base objetivo
en la primera ejecución. Las migraciones se ejecutan en orden por timestamp
prefijado (`YYYYMMDDHHMMSS_*`).

## Convenciones

- Idioma: identificadores en inglés (mismo estándar que `01_schema.sql`);
  comentarios/COMMENTs en español.
- Cada migración debe ser **reversible**: incluir `-- down` con el SQL inverso.
- No duplicar definiciones del baseline: solo deltas.
- Probar contra el contenedor de integración:
  `npm run test:integration:postgres` (docker compose levantará postgres-test).
## Drift check (CI)

CI job `migration-drift` runs `database/scripts/check-migration-drift.sh`: it
builds a database from the base branch baseline, marks the base migrations as
applied (`up --fake`), applies the new ones and compares the resulting schema
with a database built from the current `01_schema.sql`
(`database/scripts/schema-fingerprint.sql`). It also runs every new
migration's `.down.sql` then `up` again, and re-applies each `.up.sql`. Run it
locally against any throwaway PostgreSQL 15+ server:

```bash
PG_BASE_URL=postgres://postgres:postgres@localhost:5432 \
  database/scripts/check-migration-drift.sh origin/main
```

Notes on the node-pg-migrate 9 CLI as wired in `package.json`:

- Migrations are recorded by file name without `.sql`, e.g.
  `0000000000007_schema_integrity.up` (the `.up` suffix is part of the name).
- `npm run db:migrate:down` runs `database/scripts/migrate-down.sh`: it reads
  the last row of `pgmigrations` (`...x.up`), runs `...x.down.sql` and deletes
  that row in one transaction (`psql -1`). One migration per run; needs
  `psql` on PATH. node-pg-migrate's own `down` cannot match the `.up` names.
- The CLI has no `baseline` action: `npm run db:baseline` is `up --fake`, which
  marks every migration file as applied without running it.
- Do not write `-- up migration` / `-- down migration` comment lines inside a
  file: the loader uses them as section markers.
- Never put `BEGIN;`/`COMMIT;` in a migration: node-pg-migrate wraps the run
  in a transaction.
