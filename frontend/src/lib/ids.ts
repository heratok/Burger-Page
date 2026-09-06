/**
 * Returns a unique temporary identifier shaped as `prefix-<uuid>`.
 *
 * Uses `crypto.randomUUID()` so two calls within the same millisecond
 * never collide. Use for any optimistic local id that needs to remain
 * unique before the backend response replaces it.
 */
export function nextTempId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
