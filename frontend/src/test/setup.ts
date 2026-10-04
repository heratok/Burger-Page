import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { notifyManager } from '@tanstack/react-query'
import { appQueryClient, MUTATION_DEFAULTS } from '@/core/query/queryClient'

// Query observers are notified in a microtask instead of a setTimeout(0), so a
// cache update made inside act() is rendered before act() returns.
notifyManager.setScheduler(queueMicrotask)

const originalFetch = globalThis.fetch

// Tests that mount RestaurantProvider share the app client: no retries, and the
// cache is dropped after each test so tenants never leak between tests.
appQueryClient.setDefaultOptions({
  queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
  mutations: { ...MUTATION_DEFAULTS, retry: false },
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

