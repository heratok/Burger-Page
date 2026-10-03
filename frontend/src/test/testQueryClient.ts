import { QueryClient } from "@tanstack/react-query"

/** Isolated QueryClient for one test: no retries, cache discarded with the client. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
