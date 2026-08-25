# Tasks: Restaurant Reports & Data Export Suite

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 320–380 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Complete CSV export engine, ReportsManager UI, and router integration | PR 1 | `npm test` | Browser navigation to `/admin/reports` | Revert `core/export/`, `ReportsManager.tsx`, and route registration |

---

## Phase 1: Core Export Engine & Transformers

- [x] 1.1 Create `frontend/src/core/export/csvExport.ts` with RFC-4180 escaping, UTF-8 BOM (`\uFEFF`), and browser blob trigger `downloadCsv(filename, content)`.
- [x] 1.2 Create `frontend/src/core/export/reportGenerators.ts` with transformer functions:
  - `generateSalesCsv(orders)`
  - `generateCashCloseout(orders, dateLabel)`
  - `generateCustomersCsv(customers)`
  - `generateInventoryCsv(inventory)`
- [x] 1.3 Create `frontend/src/core/export/index.ts` exporting all utilities.

## Phase 2: CRM Navigation & Routing Integration

- [x] 2.1 Update `frontend/src/types/restaurant.ts` to add `"reports"` to `AdminTab` union type.
- [x] 2.2 Update `frontend/src/core/router/useAppRouter.ts` to include `"reports"` in `VALID_ADMIN_TABS`.
- [x] 2.3 Update `frontend/src/features/crm/AdminLayout.tsx` to add "Reportes & Analítica" navigation item with `BarChart3` icon.

## Phase 3: Reports UI & Cash Closeout Component

- [x] 3.1 Create `frontend/src/features/crm/ReportsManager.tsx`:
  - Date preset filter chips (`Hoy`, `Ayer`, `Últimos 7 días`, `Este Mes`, `Todo`).
  - Key financial metrics cards (Ventas Totales, Ticket Promedio, Domicilios, Efectivo vs Transferencia).
  - Cashier Shift Closeout (Z-Report) executive slip with printable stylesheet (`window.print()`).
  - 1-click export triggers for Sales CSV, Customer CRM CSV, and Inventory CSV with sonner toast feedback.
- [x] 3.2 Update `frontend/src/features/crm/index.ts` to export `ReportsManager`.
- [x] 3.3 Update `frontend/src/App.tsx` with lazy import for `ReportsManager` and render under `adminTab === "reports"`.

## Phase 4: Unit Testing & Verification

- [x] 4.1 Create `frontend/src/core/export/csvExport.test.ts` testing RFC-4180 quoting, comma escaping, newline handling, UTF-8 BOM, and closeout math.
- [x] 4.2 Run test suite `npm test` in `frontend` and verify all tests pass.
- [x] 4.3 Verify typecheck with `npm run typecheck` across the project.
