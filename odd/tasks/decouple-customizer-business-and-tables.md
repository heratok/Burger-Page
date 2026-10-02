# Feature: Decouple Customizer Business and Tables

## Objective
Decouple operational and business domain modules (`tables` and `business`/store settings) from `StorefrontCustomizer`, establishing them as first-class CRM modules in `AdminLayout` navigation (`/admin/tables` and `/admin/settings`), leaving `StorefrontCustomizer` with single responsibility for visual theming and UI customization.

## Problem
In the original design, `CustomizerBusinessSection` (delivery fees, minimum orders, opening hours, timezone, pause switch, store address) and `CustomizerTablesSection` (physical dining tables and QR code generation) were placed as tabs inside `StorefrontCustomizer`. This violates the Single Responsibility Principle and confuses the user's mental model:
1. Storefront Customizer should exclusively govern visual aesthetics, typography, branding, and live store simulation.
2. Table and QR management is an in-person physical salon operation.
3. Business settings and delivery thresholds are commercial operational configurations.

## Scope & Constraints
- Add `"tables"` and `"settings"` to `AdminTab` and `VALID_ADMIN_TABS`.
- Add dedicated sidebar navigation entries in `AdminLayout.tsx`.
- Wire `adminTab === "tables"` to `TablesManager` and `adminTab === "settings"` to `StoreSettingsManager` in `App.tsx`.
- Clean up `StorefrontCustomizer` to strictly maintain 4 visual tabs (`templates`, `branding`, `colors`, `uiux`).
- Keep full backward compatibility with `storeConfig` updates and table hooks.
- Zero regressions across existing frontend test suites and typechecks.

## Tasks
- [x] **TASK-01**: Add `"tables"` and `"settings"` to `AdminTab` in `frontend/src/types/restaurant.ts` and `VALID_ADMIN_TABS` in `frontend/src/core/router/useAppRouter.ts`.
- [x] **TASK-02**: Add "Mesas & QR" and "Ajustes de Negocio" navigation items to `restaurantNavItems` in `frontend/src/features/crm/AdminLayout.tsx`.
- [x] **TASK-03**: Create `StoreSettingsManager.tsx` and `TablesManager.tsx` standalone CRM features and wire them in `frontend/src/App.tsx`.
- [x] **TASK-04**: Decouple `StorefrontCustomizer.tsx` to feature 4 visual tabs, updating tab grid layout and removing business/tables tabs.
- [x] **TASK-05**: Update and expand tests in `StorefrontCustomizer.test.tsx`, `useAppRouter.test.ts`, and `AdminLayout.test.tsx`, verifying full test suite passes.

## Verification Evidence
- `npm run typecheck:frontend`: Passed with 0 errors.
- `npm run test:frontend`: 85 test suites, 716 tests passing (0 failures).
- `npm run build:frontend`: Built in 663ms with code-split chunks for `StoreSettingsManager` and `TablesManager`.
- Verified roving tabIndex keyboard navigation across 4 columns in StorefrontCustomizer.

## Delivery Strategy
- ask-on-risk
- Route: direct
