import { beforeEach, afterEach, vi } from 'vitest'

const originalFetch = globalThis.fetch

beforeEach(() => {
  // Default mock for fetch in unit tests to simulate offline backend and prevent ECONNREFUSED network calls
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    throw new TypeError('fetch failed: offline test environment')
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})
