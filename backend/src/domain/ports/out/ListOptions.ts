/**
 * Shared pagination contract for tenant list endpoints.
 *
 * Backward-compatible by design: when no options are provided, repository
 * finders and use cases return the exact full array they returned before
 * pagination existed. When `limit` is a positive integer, drivers apply a
 * bounded page slice (1-based `page`, defaults to 1) and use cases return a
 * `PaginatedResult` with the matching slice plus the tenant-scoped total.
 */
export interface ListOptions {
  /** 1-based page number. Defaults to 1 when omitted. */
  page?: number;
  /** Positive items-per-page bound (controllers clamp to 1..100). */
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}