export function parseLocalDateRange(dateStr: string, isEndOfDay: boolean): string | undefined {
  if (!dateStr) return undefined
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return undefined
  const [y, m, d] = parts
  if (isEndOfDay) {
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}
