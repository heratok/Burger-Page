import { QueryClient } from "@tanstack/react-query"
import { MUTATION_DEFAULTS } from "@/core/query/queryClient"

/** Isolated QueryClient for one test: no retries, cache discarded with the client. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { ...MUTATION_DEFAULTS, retry: false },
    },
  })
}
