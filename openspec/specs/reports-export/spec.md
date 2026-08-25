# reports-export Specification

## Purpose

Provide restaurant owners with actionable reporting and data export capabilities directly within the CRM backoffice, enabling date-filtered sales analysis, daily cashier closeout calculations, customer directory exports, and inventory valuation audits in Excel-compatible CSV format and printable layouts.

## Requirements

### Requirement: Sales Transactions Export to CSV

The system MUST allow restaurant managers to export order history within a selected date range into an RFC-4180 compliant CSV file encoded with UTF-8 BOM.

#### Scenario: Successful order history export with date filter
- GIVEN the restaurant has orders placed across multiple dates
- WHEN the user selects the "This Month" date filter and clicks "Export Sales CSV"
- THEN the system generates a downloadable `.csv` file containing only orders matching the date range
- AND the CSV headers include `Order ID`, `Date`, `Time`, `Customer Name`, `Phone`, `Address`, `Items`, `Subtotal`, `Delivery Fee`, `Total`, `Payment Method`, and `Status`
- AND the file begins with byte sequence `\uFEFF` for native Microsoft Excel character decoding.

#### Scenario: Exporting sales with empty order set
- GIVEN no orders exist in the selected date window
- WHEN the user attempts to export sales CSV
- THEN the system displays a non-blocking toast warning indicating no data is available to export.

---

### Requirement: Daily Cashier Shift Closeout (Z-Report)

The system MUST compute aggregated financial metrics for any chosen single date or range, breaking down income by payment method (Cash vs. Bank Transfer) and active vs. cancelled totals.

#### Scenario: Accurate cashier closeout calculation
- GIVEN 5 delivered orders paid with "Efectivo" totaling $150,000 and 3 delivered orders paid with "Transferencia" totaling $90,000, plus 1 cancelled order of $30,000
- WHEN the manager opens the Cash Closeout tab for that day
- THEN the system displays Total Net Sales of $240,000
- AND displays Cash Total of $150,000 and Transfer Total of $90,000
- AND excludes cancelled order values from net revenue while displaying the cancelled count.

#### Scenario: Printable cashier closeout slip
- GIVEN the user views the Cash Closeout summary
- WHEN the user clicks "Imprimir Cierre"
- THEN the system triggers browser print styling rendering a receipt/slip with restaurant name, date, sales breakdown, and signature lines.

---

### Requirement: CRM Customer Directory Export to CSV

The system MUST allow managers to export all customer profiles or filtered segments into a CSV file.

#### Scenario: Exporting customer directory
- GIVEN registered customer records with loyalty tiers and spend totals
- WHEN the user clicks "Export Customers CSV"
- THEN the system downloads a `.csv` file containing `Name`, `Phone`, `Address`, `Neighborhood`, `Total Orders`, `Total Spent`, `Loyalty Tier`, `Last Order Date`, and `Internal Notes`.

---

### Requirement: Inventory Stock & Valuation Export to CSV

The system MUST allow managers to export complete inventory audits including stock levels, unit costs, low stock alerts, and financial asset valuations.

#### Scenario: Exporting inventory valuation audit
- GIVEN inventory items with quantities and unit costs
- WHEN the user clicks "Export Inventory CSV"
- THEN the system downloads a `.csv` file with columns `Item Name`, `Category`, `Current Stock`, `Unit`, `Cost Per Unit`, `Total Value`, `Min Stock Alert`, and `Stock Status (OK/LOW)`.

---

### Requirement: Reports & Analytics Navigation and Date Range Filtering

The system MUST provide a dedicated `"reports"` tab in `AdminLayout` accessible at `/admin/reports` with interactive quick filters (`Today`, `Yesterday`, `Last 7 Days`, `This Month`, `All Time`).

#### Scenario: Selecting date preset updates metrics and export preview
- GIVEN the user navigates to `/admin/reports`
- WHEN the user clicks the "Last 7 Days" filter chip
- THEN the order list, financial metrics, and export data update instantaneously to reflect orders within the last 7 calendar days.
