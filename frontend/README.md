# Restaurant CRM (frontend)

A **local-first, multi-tenant restaurant CRM**. It lets restaurant owners manage
their menu, products, and orders, and lets a super admin manage every restaurant
from one panel. Each restaurant gets its own public storefront that customers
reach through a shared direct link.

There is no backend and no external deployment dependency in this repo: all data
is persisted in the browser's `localStorage` behind a single repository seam.

> **New to the codebase?** Read [`CONTEXT.md`](CONTEXT.md) first — it maps the
> three view areas, the repository seam, and role scoping with exact paths. The
> [Architecture Decision Records](docs/adr/) explain the "why" behind the big
> decisions.

## The three view areas

| Area | Route | Who | What it does |
|------|-------|-----|--------------|
| Storefront | `/:slug` | Customers | Browse the menu, customize, and place an order via WhatsApp |
| Admin | `/admin` | A restaurant's admin | Manage that restaurant's products, orders, and config |
| Super admin | `/admin` | Super admin | Manage every restaurant, global summary, super password |

`/` redirects to `/admin`. Unknown slugs and stale selections render a
not-found state. Data access is role-scoped so a restaurant admin only ever sees
their own tenant.

## Getting started

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
```

The app uses a hash router, so after `npm run dev` the URL includes a `#` (e.g.
`http://localhost:5173/#/admin`).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the full vitest suite (regression safety net) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run build` | Type-check, then produce a production build |
| `npm run lint` | Lint the frontend |

## Folder map

```
frontend/
  CONTEXT.md        # architecture map, seam, scoping, conventions (read me first)
  docs/adr/         # ADR-0001..0004 — the "why" behind key decisions
  src/
    app/            # routes + app shell
    features/
      storefront/   # customer area (/ :slug)
      admin/        # admin area (/admin) — role-scoped
      superadmin/   # super admin area
    shared/
      domain/       # pure domain logic + types (+ resumen module)
      ui/           # shared presentational components (+ ui/ primitives)
      validation/   # form schemas
      storage/      # repository seam + localStorage adapter/singleton
    store/          # React contexts (cart, admin session)
    data/           # seed data
```

## Architecture notes

- **Repository seam** — `src/shared/storage/repository.ts` defines
  `RestaurantRepository` (per-tenant) and `DirectoryRepository` (cross-tenant);
  `src/shared/storage/storage.ts` implements them with `LocalStorageRepository`
  and exports the `storage` singleton. UI code reads/writes through these
  interfaces, never `localStorage` directly. See
  [ADR-0001](docs/adr/ADR-0001-localstorage-seam-and-envelope.md).
- **Role scoping** — `/admin` gates on session and hands sections a scoped
  repository through the Outlet context, so a restaurant admin only sees its own
  tenant. See [ADR-0002](docs/adr/ADR-0002-admin-role-scoping-and-scoped-outlet-repo.md).
- **Session vs view** — who is logged in (persistent session) is kept separate
  from which restaurant a super admin is viewing (transient, reload-reset). See
  [ADR-0003](docs/adr/ADR-0003-session-grant-vs-view-selection.md).
- **Theming** — each restaurant's palette is derived deterministically into CSS
  variables, including the chart ramp. See
  [ADR-0004](docs/adr/ADR-0004-palette-and-chart-derivation.md).

## Stack

- React 18 + React Router 7 (hash routing)
- Vite + TypeScript
- Tailwind CSS 4 + shadcn/base-ui primitives (`src/shared/ui/ui/`)
- Recharts (resumen dashboards)
- Vitest + Testing Library (colocated tests, strict TDD)
- Zod (form validation)

## Contributing

Follow the conventions in [`CONTEXT.md`](CONTEXT.md): colocated tests, strict
TDD with `npm test` as the safety net, cross-area imports via `@/`, and read
through the repository seam. Prefer updating the ADRs over re-litigating a
recorded decision.
