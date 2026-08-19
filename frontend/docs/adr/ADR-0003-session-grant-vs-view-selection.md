# ADR-0003: session grant vs view selection

## Status

Accepted.

## Context

The admin panel needs two different kinds of "who am I looking at" that were
historically conflated into one boolean grant flag (`burger-page:admin-granted`):

1. **Who is logged in** — a persistent, reload-surviving session that answers
   "am I a super admin or the admin of restaurant X?"
2. **Which restaurant the super admin is currently viewing** — a transient,
   in-panel selection that answers "of the restaurants I can see, which one am
   I looking at right now?"

Treating the super's in-panel selection as if it were a per-restaurant login
grant (writing `burger-page:admin-granted:{id}` keys) would leave behind a
trail of stale "grants" that a restaurant admin session could accidentally
inherit, blurring the tenant boundary.

## Decision

- **Session grant** lives in `AdminContext` / `admin-context.ts` and is stored
  in `sessionStorage` (survives reload, dies with the tab). It records `WHO`:
  `{ mode: "super" }` or `{ mode: "restaurant"; restaurantId }`. The legacy
  boolean grant migrates into a restaurant-mode session for the first
  restaurant during the transition.
- **View selection** lives in `AdminShell` component state
  (`activeRestaurantId`) and is only meaningful while a super session is
  active. It records `WHAT the super is looking at` and **dies on reload** —
  it is never persisted as a grant.
- The switcher (`AdminSwitcher`) writes **no** `admin-granted:{id}` keys. It
  only calls the shell's `onSelect` to change view state. See the code comment
  in `AdminShell.tsx`: "it is NOT a session grant and never creates a
  restaurant grant key."
- `AdminShell` reconciles the two: the scoped Outlet repository is the session's
  own restaurant for a restaurant admin, or the switcher selection for a super
  (see ADR-0002).

## Consequences

- **Positive:** no stale per-restaurant grant keys accumulate; the only
  persisted auth state is the single active session.
- **Positive:** reload resets a super to the global summary (safe default),
  never to a remembered restaurant view.
- **Positive:** the model maps cleanly onto the role rules — a restaurant
  session simply cannot see the switcher at all.
- **Negative:** a super's drill-in selection does not survive reload (by
  design — restoring it would require persisting view state, which we
  deliberately avoid).

## References

- `src/store/admin-context.ts` — `AdminSession`, `sessionMatches`,
  `readStoredSession`, `clearStoredSession`, grant keys.
- `src/features/admin/AdminShell.tsx` — `activeRestaurantId` view state,
  `selectedRestaurant` reconciliation, `AdminSwitcher` usage.
- `src/features/superadmin/AdminSwitcher.tsx` — value/`onSelect` view-only
  contract.
