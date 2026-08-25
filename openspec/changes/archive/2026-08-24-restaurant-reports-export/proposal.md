# Proposal: Restaurant Reports & Data Export Suite

## Intent

Restaurant owners currently lack tools to export their business operational data. They cannot export sales history, generate daily cashier closeouts (Z-reports), export CRM customer directories for marketing campaigns, or export inventory stock valuations for accounting. This change introduces a dedicated Reports & Analytics module with client-side RFC-4180 CSV export (with UTF-8 BOM for Excel) and printable summaries.

## Scope

### In Scope
- **Sales & Orders Export**: Filter orders by date presets (Today, Last 7 Days, This Month, Custom) and export detailed order rows (ID, date, customer, items, payment method, totals) to CSV.
- **Daily Cash Closeout (Cierre de Caja)**: Calculate executive cash register summaries (cash vs. transfer totals, completed vs. cancelled count, delivery fee totals) with a clean printable/PDF layout.
- **Customer CRM Export**: Export customer directories (name, phone, address, total spent, order count, loyalty tier, internal notes) to CSV.
- **Inventory & Stock Audit Export**: Export current stock levels, low-stock warnings, cost per unit, and total valuation to CSV.
- **Admin Navigation & UI**: Add `"reports"` tab to `AdminLayout` and `useAppRouter` with interactive previews and 1-click export actions.

### Out of Scope
- Backend server-side PDF rasterization engines (Chromium/Puppeteer).
- Automated scheduled email delivery of reports.
- Multi-branch cross-tenant aggregate reports.

## Capabilities

### New Capabilities
- `reports-export`: End-to-end report generation, date filtering, cashier shift closeout calculations, and RFC-4180 CSV / printable export for orders, customers, and inventory.

### Modified Capabilities
- None

## Approach

Implement a client-side export architecture:
1. `core/export/csvExport.ts`: Generic, type-safe RFC-4180 CSV encoder that prepends UTF-8 BOM (`\uFEFF`) ensuring seamless Excel opening without encoding corruption.
2. `core/export/reportGenerators.ts`: Specialized transformers mapping domain entities (`Order`, `Customer`, `InventoryItem`) into formatted tabular export schemas.
3. `features/crm/ReportsManager.tsx`: Comprehensive backoffice view with KPI summary cards, date range selector, breakdown of sales by payment method, cashier closing slip, and instant download/print buttons.
4. Integrate with `AdminLayout`, `AdminTab` type, and `useAppRouter`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/types/restaurant.ts` | Modified | Add `"reports"` to `AdminTab` union |
| `frontend/src/core/router/useAppRouter.ts` | Modified | Add `"reports"` to `VALID_ADMIN_TABS` |
| `frontend/src/core/export/csvExport.ts` | New | Client-side CSV generator with UTF-8 BOM |
| `frontend/src/core/export/reportGenerators.ts` | New | Domain to CSV row transformers & Cash Closeout math |
| `frontend/src/features/crm/ReportsManager.tsx` | New | Reports & analytics dashboard UI |
| `frontend/src/features/crm/AdminLayout.tsx` | Modified | Add "Reportes & Analítica" navigation item |
| `frontend/src/App.tsx` | Modified | Lazy route registration for `ReportsManager` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Excel garbles special characters/accents in CSV | Medium | Prepend UTF-8 BOM (`\uFEFF`) to all exported CSV blobs |
| Date filtering timezone discrepancies | Low | Use local ISO date strings matching restaurant local timezone |

## Rollback Plan

Revert added export files and remove the `"reports"` tab entry from `restaurant.ts`, `useAppRouter.ts`, and `AdminLayout.tsx`.

## Dependencies

- None (100% native client-side, zero added npm packages).

## Success Criteria

- [ ] Restaurant owners can export Sales, Cash Closeout, CRM Customers, and Inventory to CSV.
- [ ] Exported CSV files open with correct Spanish accents in Microsoft Excel and Google Sheets.
- [ ] Daily cashier closeout presents clear Cash vs Transfer totals and can be printed.
- [ ] Navigation via `/admin/reports` works seamlessly with zero TypeScript/lint errors.
