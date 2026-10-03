import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/** Isolated QueryClient for one test: no retries, cache discarded with the client. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

/** Wraps children in a QueryClientProvider; pass `client` to share a cache across renders. */
export function createQueryWrapper(client: QueryClient = createTestQueryClient()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return Wrapper
}
