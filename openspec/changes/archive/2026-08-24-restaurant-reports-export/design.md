# Design: Restaurant Reports & Data Export Suite

## Technical Approach

We implement a client-side reporting and export architecture that processes orders, customers, and inventory directly in memory from `RestaurantContext`. The solution is composed of:
1. **Core CSV Serializer (`core/export/csvExport.ts`)**: Pure RFC-4180 encoder handling escaping, quoting, line breaks, and prepending the UTF-8 BOM (`\uFEFF`) for Excel compatibility.
2. **Domain Transformers (`core/export/reportGenerators.ts`)**: Pure transformation functions turning entity collections into structured tabular records and calculating cash closeouts.
3. **Reports & Analytics Feature (`features/crm/ReportsManager.tsx`)**: Reactive UI component providing date range controls (`today`, `yesterday`, `7days`, `month`, `all`), cashier shift summary (Z-report), and export triggers.
4. **App Routing & Navigation**: Integration with `AdminLayout`, `AdminTab`, and `useAppRouter`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| **Client-side CSV & Print vs Server-side Backend** | Client-side requires zero backend dependencies and works offline/locally; Server-side scales to 1M+ rows but requires Node/DB connectivity. | **Client-side**: Fits current multi-tenant architecture with instant sub-millisecond downloads. |
| **Pure RFC-4180 implementation vs External npm lib (`papaparse`/`xlsx`)** | Custom serializer adds 0 KB to bundle; external lib adds 50–300 KB. | **Custom RFC-4180 serializer with UTF-8 BOM**: Lightweight, zero dependency overhead. |
| **Print CSS Modal vs PDF generator (`jspdf`)** | Browser native print dialog (`window.print()`) is 0 KB and fully styled with Tailwind `@media print`; PDF libs add 200+ KB and font issues. | **Native Print with Tailwind print stylesheet**: Clean, crisp receipt & summary printout. |

## Data Flow

```
   [RestaurantContext] (orders, customers, inventory)
            │
            ▼
   [ReportsManager UI] (Date range state: today / 7d / month)
      │          │
      ▼          ▼
[Filtered Data] [Cash Closeout Calculations]
      │                  │
      ▼                  ▼
[reportGenerators.ts] [Printable HTML / CSS]
      │
      ▼
[csvExport.ts (RFC-4180 + BOM)] ───► [Browser Blob Download (.csv)]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/core/export/csvExport.ts` | Create | Pure RFC-4180 CSV serializer with UTF-8 BOM and download trigger |
| `frontend/src/core/export/reportGenerators.ts` | Create | Domain mappers for Sales, Cashier Closeout, Customers, and Inventory |
| `frontend/src/core/export/csvExport.test.ts` | Create | Unit tests verifying escaping, quotes, BOM, and formatting |
| `frontend/src/features/crm/ReportsManager.tsx` | Create | Complete reports UI with date filters, metrics, cash slip, and export buttons |
| `frontend/src/types/restaurant.ts` | Modify | Add `"reports"` to `AdminTab` union |
| `frontend/src/core/router/useAppRouter.ts` | Modify | Add `"reports"` to `VALID_ADMIN_TABS` |
| `frontend/src/features/crm/AdminLayout.tsx` | Modify | Add "Reportes & Analítica" sidebar nav item with icon |
| `frontend/src/features/crm/index.ts` | Modify | Export `ReportsManager` |
| `frontend/src/App.tsx` | Modify | Lazy load and mount `ReportsManager` when `adminTab === "reports"` |

## Interfaces / Contracts

```typescript
export interface CsvColumn<T> {
  header: string
  accessor: (item: T) => string | number | undefined | null
}

export interface CashCloseoutReport {
  dateRangeLabel: string
  totalSales: number
  totalOrdersCount: number
  deliveredOrdersCount: number
  cancelledOrdersCount: number
  cashTotal: number
  transferTotal: number
  deliveryFeesTotal: number
  avgTicket: number
  generatedAt: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `csvExport.ts` and `reportGenerators.ts` | Test CSV escaping (commas, quotes, newlines), UTF-8 BOM, and closeout math |
| Component | `ReportsManager.tsx` | Test date preset filtering, KPI updates, and download trigger mocks |
| Routing | `useAppRouter.ts` | Verify `/admin/reports` correctly resolves `view: "admin", adminTab: "reports"` |

## Threat Matrix

N/A — No routing to external untrusted URLs, no shell commands, subprocesses, or executable file generation. All CSV data is strictly sanitized text values.

## Migration / Rollout

No migration required. Non-breaking additive change to CRM navigation.
