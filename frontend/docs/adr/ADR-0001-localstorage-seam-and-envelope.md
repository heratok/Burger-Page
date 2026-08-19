# ADR-0001: localStorage-only repository seam with a single v2 envelope

## Status

Accepted.

## Context

The restaurant CRM is a local-first single-page app with no backend. All tenant
data — restaurants, their config/palette, products, modifiers, and orders — must
be persisted somewhere the browser can reach synchronously.

Earlier iterations stored data in a loose, versionless shape that mixed
single-tenant fields (a flat `config`/`products`/`orders`) with no explicit
tenant boundaries. That made it impossible to reason about cross-restaurant
isolation, to migrate safely, or to swap storage without touching every page.

Two structural needs drove the decision:

1. **A repository seam.** Pages and features should depend on an interface
   (`RestaurantRepository` / `DirectoryRepository`), not on a concrete storage
   mechanism, so a future HTTP backend can replace the localStorage adapter
   without changing consumers.
2. **A stable, versioned persistence envelope.** Storage needs a single shape
   with a version field so seed, migrate, and corrupt-recovery are atomic and
   well-defined.

## Decision

- Persist **one** envelope per app under the single key `burger-page:crm`
  (see `STORAGE_KEY` in `src/shared/storage/storage.ts`).
- The envelope is **`StorageEnvelopeV2`**: `{ version: 2, superAdminPassword,
  restaurants: Restaurant[] }`. Every restaurant carries its own `config`,
  `palette`, `products`, `modifiers`, and `orders` collections
  (`src/shared/domain/domain.ts`).
- The seam lives in `src/shared/storage/repository.ts`:
  - `RestaurantRepository` — the scoped per-tenant API (config, palette,
    products, modifiers, orders).
  - `DirectoryRepository` — the cross-tenant API (`listRestaurants`,
    `getBySlug`, `getRepositoryFor`, create/delete/update restaurant,
    super-admin password).
- The single concrete adapter is `LocalStorageRepository`
  (`src/shared/storage/storage.ts`), which implements both interfaces and is
  exposed to the app as the `storage` singleton
  (`new LocalStorageRepository(window.localStorage)`).
- Reads go through `read()`: missing key → seed from `src/data/data.ts`;
  version `< 2` → run the migration chain (legacy data becomes the first
  restaurant, slug `burger-page`); corrupt/unparseable → reseed. Writes go
  through `persist()`. There are no partial/orphan storage states.
- Consumers depend on the interfaces, not on `storage` directly; production
  passes the singleton (or a scoped repo derived from it), and tests inject a
  fake directory or an in-memory `Storage`.

## Consequences

- **Positive:** one envelope means migration and corrupt-recovery are single
  code paths; the seam keeps the UI decoupled from localStorage; tests can
  inject fakes without touching `window.localStorage`.
- **Positive:** the version field makes forward-compatible (future-version)
  reads explicit and safe.
- **Negative:** all data lives under one key, so a very large dataset
  re-serializes the whole envelope on every write (acceptable for a local-first
  CRM at this scale).
- **Negative:** localStorage is synchronous and browser-bound — there is no
  cross-device sync. The seam exists to make a future backend swap cheap, but
  no second adapter is implemented yet.

## References

- `src/shared/storage/repository.ts` — the two interfaces (the seam).
- `src/shared/storage/storage.ts` — `LocalStorageRepository`, `storage`
  singleton, `read`/`persist`/`seed`/`migrate`.
- `src/shared/domain/domain.ts` — `StorageEnvelopeV2`, `Restaurant`.
