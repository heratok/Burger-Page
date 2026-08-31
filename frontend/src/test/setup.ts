import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

const originalFetch = globalThis.fetch

beforeEach(() => {
  // Default mock for fetch in unit tests to simulate offline backend and prevent ECONNREFUSED network calls
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    throw new TypeError('fetch failed: offline test environment')
  })
})

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

