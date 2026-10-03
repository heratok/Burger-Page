import { QueryClient } from "@tanstack/react-query"

/**
 * Builds the app-wide QueryClient. Server state is considered fresh for 30s
 * and never refetched on window focus: the slices already own explicit
 * refresh points (login, tenant switch, post-mutation invalidation).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/** Shared client used by the composed RestaurantProvider unless one is injected. */
export const appQueryClient = createQueryClient()
