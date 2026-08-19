# Frontend Context — Restaurant CRM (`frontend/`)

This file is the entry point for understanding the codebase. If you are a fresh
agent (human or AI) dropped into `frontend/`, read this first, then the
[Architecture Decisions](docs/adr/) for the why behind the big choices.

It is a **multi-tenant restaurant CRM** with three view areas, a single
local-first storage seam, and role-scoped data access. There is no backend:
everything lives in the browser's `localStorage`.

> **The three things to locate before touching code:** (1) the three view
> areas, (2) the repository seam, (3) where role/tenant scoping happens. Each is
> mapped below with exact paths — no source spelunking needed.

---

## Quick map: three view areas

| Area | Route | Folder | Who | Reads data through |
|------|-------|--------|-----|--------------------|
| Storefront | `/:slug` | `src/features/storefront/` | Customers | scoped repo via `directory.getBySlug(slug)` |
| Admin | `/admin/*` | `src/features/admin/` | Restaurant admin **or** super | scoped repo via **Outlet context** |
| Super admin | `/admin/*` (super session) | `src/features/superadmin/` | Super admin | directory + scoped repo |

Route wiring lives in `src/app/App.tsx`:

```
/                    → redirect to /admin (no public directory)
/:slug               → Storefront (unknown slug → not-found)
/r/:slug             → legacy storefront redirect → /:slug
/r/:slug/admin       → legacy redirect → /admin
/admin               → AdminGate → AdminShell
  index               → AdminIndex
  products/orders/config → Scoped* wrappers (restaurant sections)
  restaurants, restaurants/new, restaurants/:id/edit → super sections
  password            → SuperPasswordPage
*                    → NotFoundState
```

---

## The repository seam (storage)

**The single rule: UI code reads and writes through repository interfaces, not
through `localStorage` directly.** This is the backend-swap seam.

- **Interfaces (the seam):** `src/shared/storage/repository.ts`
  - `RestaurantRepository` — the per-tenant API: `getConfig`, `getPalette`,
    `listProducts`, `listModifiers`, `listOrders`, `saveOrder`,
    `updateOrderStatus`, plus their save/delete counterparts.
  - `DirectoryRepository` — the cross-tenant API: `listRestaurants`,
    `getBySlug`, `getRepositoryFor`, `createRestaurant`, `deleteRestaurant`,
    `updateRestaurant`, super-admin password accessors.
- **Single adapter:** `LocalStorageRepository` in
  `src/shared/storage/storage.ts`, exposed as the app-wide **`storage`
  singleton** (`new LocalStorageRepository(window.localStorage)`).
- **Scoped factory:** `directory.getRepositoryFor(id)` returns a repository
  bound to one `restaurantId` — the primitive behind all tenant isolation.
- **Scoped miss (MT-3):** a scoped repository built for an unknown
  `restaurantId` never falls back to another tenant. Scoped reads
  (`getConfig`, `getPalette`, `listProducts`, `listModifiers`, `listOrders`)
  return `undefined`, `saveOrder` returns `undefined`, `updateOrderStatus`
  returns `false`, and the other writes are no-ops. Consumers coalesce reads
  (`?? []`, `?? DEFAULT_CONFIG`) and CheckoutForm fails closed when `saveOrder`
  yields no record. The un-scoped `storage` singleton keeps the legacy
  first-restaurant view.
- **Persistence envelope:** one key `burger-page:crm` holding a single
  `StorageEnvelopeV2` (`{ version, superAdminPassword, restaurants[] }`). See
  [ADR-0001](docs/adr/ADR-0001-localstorage-seam-and-envelope.md).
- **Storage is localStorage-only today.** `src/store/` (React contexts) and
  `src/data/` (seed data) are **not** part of the moved feature tree — they stay
  where they are. The seam is where a future HTTP adapter would land.

---

## Where scoping happens (the second thing to find)

- **Storefront** (`src/features/storefront/Storefront.tsx`): resolves the
  restaurant by slug through an **injectable `directory` prop** (defaults to the
  `storage` singleton). Unknown slug → `NotFoundState`. All reads go through
  `directory.getRepositoryFor(restaurant.id)`.
- **Admin gate** (`src/features/admin/AdminGate.tsx`): authenticates. A match
  against the super password opens a `super` session; a match against any
  restaurant's admin password opens a `restaurant` session scoped to that
  restaurant. Wrong password → error, no grant.
- **Admin shell** (`src/features/admin/AdminShell.tsx`): computes the
  **selected restaurant** (restaurant session → its own restaurant; super →
  switcher selection or `undefined` for the global summary) and hands every
  section a **scoped repository through the Outlet context**:
  `<Outlet context={scoped} />`.
- **Section wrappers** (`src/app/App.tsx`): `ScopedProducts`/`ScopedOrders`/
  `ScopedConfig` call `useScopedRepo()` and render `NotFoundState` if the scope
  is `undefined`, so a deleted/stale selection never leaks another tenant.
- **Super sections** (`src/features/superadmin/`): `RestaurantsPage`,
  `CreateRestaurantPage`, `EditRestaurantPage`, `SuperPasswordPage`,
  `GlobalSummary`, `AdminSwitcher` — they use the **directory** (all tenants)
  plus a scoped repo for the selected restaurant. See
  [ADR-0002](docs/adr/ADR-0002-admin-role-scoping-and-scoped-outlet-repo.md).

---

## Session state vs view state (the third thing to find)

Two distinct kinds of "who am I" live in the admin panel — do not conflate them.
See [ADR-0003](docs/adr/ADR-0003-session-grant-vs-view-selection.md).

- **Session grant (WHO is logged in)** — `src/store/AdminContext.tsx` /
  `src/store/admin-context.ts`. Stored in `sessionStorage` (survives reload,
  dies with the tab). Shape: `{ mode: "super" }` or
  `{ mode: "restaurant"; restaurantId }`.
- **View selection (WHAT the super is looking at)** — `activeRestaurantId`
  React state in `AdminShell`. Transient; **dies on reload**; never written as a
  grant key. The switcher (`AdminSwitcher`) is view-only.

The storefront's cart is similarly scoped by slug through
`src/store/CartContext.tsx` (switching slugs clears the cart).

---

## Final folder tree (`frontend/src/`)

```
src/
  app/                      # App.tsx (routes), App.test.tsx, main.tsx
  features/
    storefront/             # Customer area (/ :slug)
      Storefront.tsx, ProductCard, ProductCustomize, CartView,
      CheckoutForm, MobileCartBar, CartNavbar, SearchMenu
    admin/                  # Admin area (/admin) — role-scoped
      AdminGate, AdminShell, AdminIndex, ResumenDashboard,
      OrdersPage, ProductsPage, ConfigPage
    superadmin/             # Super area — directory + scoped repo
      RestaurantsPage, CreateRestaurantPage, EditRestaurantPage,
      SuperPasswordPage, GlobalSummary, AdminSwitcher
  shared/
    domain/                 # pure domain logic + types
      domain.ts, orders.ts, analytics.ts, whatsapp.ts, slug.ts, theme.ts
      resumen/              # shared resumen module (labels, chartConfig, presenters)
    ui/                     # shared presentational components
      ThemeScope, NotFoundState, LoadingPage, CharacterCounter, NoBuy
      ui/                   # shadcn/base-ui primitives (low-level kernel)
    validation/             # form schemas (validation.ts, admin-validation.ts)
    storage/                # THE SEAM: repository.ts (interfaces), storage.ts (adapter+singleton)
  store/                    # React contexts (CartContext, AdminContext) — NOT moved
  data/                     # seed data (data.ts) — NOT moved
  test/                     # vitest setup
```

### Note: the `shared/ui/ui/` nesting

`src/shared/ui/ui/` is intentional: the **inner** `ui/` holds the low-level
shadcn/base-ui primitives (`button`, `card`, `sidebar`, `chart`, … — ~24 files),
while `src/shared/ui/` holds the app-level shared presentational components
(`ThemeScope`, `NotFoundState`, `LoadingPage`, `CharacterCounter`, `NoBuy`).
The alias `@/shared/ui/ui/*` imports primitives; `@/shared/ui/*` imports the
app-level components. Don't flatten them.

---

## Conventions

- **Tests are colocated**: `Foo.test.tsx` sits next to `Foo.tsx`. A feature
  keeps its tests in the same folder (e.g. `Storefront.test.tsx` beside
  `Storefront.tsx`).
- **Strict TDD**: changes are driven by RED → GREEN → REFACTOR; the regression
  safety net is `npm test` (vitest) in `frontend/`. Keep the full suite green.
- **Import style**: cross-area imports use the `@/` alias
  (`@/shared/storage/repository`, `@/features/admin/AdminGate`); intra-area
  imports may be relative.
- **Storage seam**: never import `localStorage` directly in UI code; go through
  the repository interfaces (see above). The `storage` singleton is the
  production adapter; tests inject fakes.
- **Labels & palette**: the plural status/payment labels and chart config live
  **exactly once** in `src/shared/domain/resumen/index.tsx`; chart colors come
  from the runtime `--chart-1..5` ramp (see
  [ADR-0004](docs/adr/ADR-0004-palette-and-chart-derivation.md)). Don't
  duplicate label strings or hardcode hex.
- **Domain terms**: Spanish UI labels are the project's own vocabulary
  (e.g. `Nuevos`/`Confirmados` status labels, `Resumen` section, `Efectivo`/
  `Transferencia` payment methods). Keep them verbatim; prose/commentary in
  code and docs is English.
