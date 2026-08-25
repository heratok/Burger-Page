/**
 * RFC-4180 Compliant CSV Serializer & Browser Downloader with UTF-8 BOM
 */

export interface CsvColumn<T> {
  header: string
  accessor: (item: T) => unknown
}

/**
 * Formats an individual cell according to RFC-4180 rules:
 * - If string contains quotes, commas, or newlines, wrap in quotes and double-escape existing quotes.
 * - Handles null/undefined gracefully as empty string.
 */
export function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }

  const str = String(value)
  // Check if cell needs quoting (contains comma, quote, or newline)
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    const escaped = str.replace(/"/g, '""')
    return `"${escaped}"`
  }

  return str
}

/**
 * Builds a complete RFC-4180 CSV string from a dataset and column definitions.
 * Includes UTF-8 Byte Order Mark (\uFEFF) at the start for Microsoft Excel compatibility.
 */
export function buildCsvString<T>(items: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((col) => formatCsvCell(col.header)).join(",")
  
  const dataRows = items.map((item) =>
    columns.map((col) => formatCsvCell(col.accessor(item))).join(",")
  )

  const csvBody = [headerRow, ...dataRows].join("\r\n")
  return `\uFEFF${csvBody}`
}

/**
 * Triggers a browser download of the CSV content.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  
  // Create object URL and invisible anchor to trigger save dialog
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", cleanFilename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
