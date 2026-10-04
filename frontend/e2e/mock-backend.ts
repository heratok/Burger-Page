import type { Page } from '@playwright/test'

/**
 * Shared network-mocking helpers for the legacy "local-first" e2e suites.
 *
 * Since the authoritative-backend change (PR #33) the storefront/admin fetches
 * its catalog and orders from the API even when a spec injects an enriched
 * envelope into localStorage. These helpers let a spec control those GETs
 * deterministically instead of depending on the live Postgres/Supabase state.
 */

export interface MockedOrder {
  id: string
  orderNumber: number
  customer: Record<string, unknown>
  items: unknown[]
  subtotal?: number
  deliveryFee?: number
  finalTotal?: number
  paymentMethod?: string
  paymentAmount?: number
  changeAmount?: number
  comment?: string
  status: string
  createdAt: string
}

export interface MockedEnvelopeData {
  orders?: MockedOrder[]
  customers?: Record<string, unknown>[]
  products?: Record<string, unknown>[]
  additions?: Record<string, unknown>[]
}

/**
 * Intercepts the backend GETs the app performs during sync and fulfills them
 * with the provided fixture data. All other requests pass through untouched.
 */
export async function mockBackendGets(page: Page, data: MockedEnvelopeData): Promise<void> {
  if (data.orders) {
    await page.route('**/api/orders?*', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: data.orders })
    })
    await page.route('**/api/orders', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: data.orders })
    })
  }
  if (data.customers) {
    await page.route('**/api/customers*', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: data.customers })
    })
  }
  if (data.products) {
    await page.route('**/api/products*', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: data.products })
    })
  }
  if (data.additions) {
    await page.route('**/api/additions*', (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      return route.fulfill({ status: 200, json: data.additions })
    })
  }
}

/**
 * Fulfills order state transitions (PATCH .../orders/:id/status) locally.
 * Pass the same `orders` array given to `mockBackendGets` to keep the mock
 * stateful like the real backend: the app re-syncs orders after a write
 * settles, and a stale GET would otherwise revert the transition.
 */
export async function mockOrderStatusTransitions(page: Page, orders?: MockedOrder[]): Promise<void> {
  await page.route('**/api/orders/*/status*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const body = route.request().postDataJSON?.() ?? {}
    // pathname: /api/orders/:id/status
    const segments = new URL(route.request().url()).pathname.split('/')
    const id = decodeURIComponent(segments[segments.length - 2] ?? '')
    const stored = orders?.find((o) => o.id === id)
    if (stored && body.status) stored.status = body.status
    return route.fulfill({
      status: 200,
      json: stored ?? { id, status: body.status },
    })
  })
}