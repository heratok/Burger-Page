# Load tests

Local-only k6 and Playwright scripts to measure backend and frontend performance. Never point them at production.

## Backend

1. Start local Postgres: `npm run db:test:start`, then create a throwaway database with `bash database/scripts/local-pg.sh create-db burger_load`.
2. Build and start the backend against it (`DATABASE_URL=postgres://app_user:app_user_test_only@localhost:5432/burger_load`, `STORAGE_DRIVER=postgres`).
3. Seed 24 restaurants (40 products and about 140 additions each): `node load-tests/seed.mjs` (refuses non-local databases).
4. Create an admin for the single-tenant scripts: `npm --prefix backend run create:admin -- loadtest_admin 'LoadTest#2026' restaurant_admin rest-burger-craft`.

| Script | Purpose |
|---|---|
| `backend.js` | Single restaurant: smoke, load and stress profiles (`-e PROFILE=...`). |
| `breakpoint.js` | Single restaurant, no think time, rising arrival rate until thresholds abort. |
| `multitenant.js` | 24 restaurants with skewed popularity; menu, orders with additions and CRM polling. Profiles: smoke, load, stress, breakpoint. |

The default admin password is only valid for the throwaway local database.

## Frontend

`frontend/` holds the bundle analysis, Lighthouse summary, concurrent-browser and checkout-flow scripts, plus the last recorded results (`results-*.txt`). Raw Lighthouse JSON is not tracked.

## Tuning knobs

- `MENU_CACHE_TTL_MS`: public menu cache TTL in ms (default 30000, `0` disables it); useful for A/B runs.
- `PG_POOL_MAX`: Postgres pool size (default 10).
