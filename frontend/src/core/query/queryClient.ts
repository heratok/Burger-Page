import { QueryClient } from "@tanstack/react-query"

/**
 * Builds the app-wide QueryClient. Server state is considered fresh for 30s
 * and never refetched on window focus: the slices already own explicit
 * refresh points (login, tenant switch, post-mutation invalidation).
 *
 * Mutations run with networkMode "always": slices fire the HTTP request at the
 * user action and hand the promise to the mutation, so pausing while offline
 * would delay rollback and keep isMutating > 0 (blocking revalidation).
 */
export const MUTATION_DEFAULTS = { networkMode: "always" } as const

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: MUTATION_DEFAULTS,
    },
  })
}

/** Shared client used by the composed RestaurantProvider unless one is injected. */
export const appQueryClient = createQueryClient()
