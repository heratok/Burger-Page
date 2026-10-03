import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { appQueryClient } from '@/core/query/queryClient'

const originalFetch = globalThis.fetch

// Tests that mount RestaurantProvider share the app client: no retries, and the
// cache is dropped after each test so tenants never leak between tests.
appQueryClient.setDefaultOptions({
  queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
  mutations: { retry: false },
})

beforeEach(() => {
  // Default mock for fetch in unit tests to simulate offline backend and prevent ECONNREFUSED network calls
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    throw new TypeError('fetch failed: offline test environment')
  })
})

afterEach(() => {
  cleanup()
  appQueryClient.clear()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

