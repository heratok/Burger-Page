# ADR-0002: /admin role scoping with a scoped Outlet repository

## Status

Accepted.

## Context

The `/admin` panel must serve two different roles from the same route:

- a **restaurant admin**, who manages exactly one restaurant and must never see
  another tenant's data;
- a **super admin**, who manages all restaurants (and, from the switcher, can
  drill into any one of them).

A single flat page that reaches for a global `storage` singleton would let any
section read whatever it liked, erasing the tenant boundary. The app needed a
clear way to say "this section is scoped to *this* restaurant" without each
page re-deriving the scope.

## Decision

- `/admin` is wrapped by `AdminGate` (auth/session) → `AdminShell` (layout and
  scoping), nested under `src/features/admin/`.
- `AdminShell` computes the **selected restaurant** from the session (a
  restaurant-mode session → its own restaurant; a super session → the switcher
  selection, or `undefined` for the global summary).
- `AdminShell` derives a **scoped repository** for that selection and hands it
  to every child route through React Router's **Outlet context**:
  `<Outlet context={scoped} />`.
- Each section page receives the scoped repo through a `Scoped*` wrapper in
  `src/app/App.tsx` (`useScopedRepo()` → `useOutletContext`). A missing scope
  (`undefined` — e.g. a deleted selection) renders `NotFoundState` instead of
  leaking the wrong tenant.
- The scoped repo is produced by the **directory factory**
  `directory.getRepositoryFor(id)` (see ADR-0001), which returns a repository
  bound to one `restaurantId`.

## Consequences

- **Positive:** the tenant boundary is enforced by construction — sections
  can only read the restaurant whose scope the shell provides; there is no
  page-level path back to the global singleton for tenant data.
- **Positive:** role behavior is a pure function of session mode + selection,
  easy to test through `AdminShell.test.tsx` and `AdminGate.test.tsx`.
- **Positive:** a stale/deleted selection degrades to the not-found state
  rather than silently showing another restaurant's data.
- **Negative:** scoping depends on the Outlet-context handshake; a page added
  outside `AdminShell` gets no scoped repo and must consciously decide what to
  show (by design).

## References

- `src/features/admin/AdminShell.tsx` — `selectedRestaurant` + `<Outlet
  context={scoped} />`.
- `src/features/admin/AdminGate.tsx` — role-driven session gate.
- `src/app/App.tsx` — `useScopedRepo` + the `ScopedProducts`/`ScopedOrders`/
  `ScopedConfig` wrappers.
