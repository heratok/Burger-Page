import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createTestQueryClient } from "./testQueryClient"

/** Per-mount isolated provider: each render tree gets its own fresh QueryClient. */
export const TestQueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(createTestQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
