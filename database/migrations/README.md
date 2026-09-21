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
4. **Revertir la última**:
   ```bash
   npm run db:migrate:down
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