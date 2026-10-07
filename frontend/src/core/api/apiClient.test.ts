import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CreateOrderInput } from '@burger-page/contracts'
import { ApiClient, ORDER_SUBMIT_TIMEOUT_MS } from './apiClient'

describe('ApiClient', () => {
  let client: ApiClient
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    client = new ApiClient({ baseUrl: 'http://localhost:3001/api' })
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const mockResponse = (data: any, ok = true, status = 200, statusText = 'OK') => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok,
      status,
      statusText,
      json: async () => data,
    })
  }

  it('sends category renames alongside the list in a single PUT', async () => {
    mockResponse({ categories: ['B'] })
    await client.updateCategories(['B'], 'slug-1', [{ from: 'A', to: 'B' }])
    const [url, init] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toBe('http://localhost:3001/api/restaurant/slug-1/categories')
    expect(JSON.parse(init.body)).toEqual({ categories: ['B'], renames: [{ from: 'A', to: 'B' }] })
  })

  describe('platform stats', () => {
    const stats = { totalRevenue: 10, totalOrders: 2, cancelledOrders: 1, totalCustomers: 1, totalRestaurants: 3, activeRestaurants: 2 }

    it('reads the platform totals without a query string by default', async () => {
      mockResponse(stats)
      await expect(client.fetchPlatformStats()).resolves.toEqual(stats)
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/platform-stats')
      expect(init?.method ?? 'GET').toBe('GET')
    })

    it('sends the optional from/to date range', async () => {
      mockResponse(stats)
      await client.fetchPlatformStats({ from: '2026-01-01', to: '2026-01-31' })
      expect((globalThis.fetch as any).mock.calls[0][0]).toBe(
        'http://localhost:3001/api/platform-stats?from=2026-01-01&to=2026-01-31'
      )
    })

    it('surfaces a server refusal as an error', async () => {
      mockResponse({ message: 'Forbidden' }, false, 403, 'Forbidden')
      await expect(client.fetchPlatformStats()).rejects.toThrow()
    })
  })

  describe('restaurant tables', () => {
    const raw = { id: 'tbl_1', restaurantId: 'r1', name: 'Mesa 1', sortOrder: 2, isActive: true, createdAt: 'x', updatedAt: 'y' }
    const mapped = { id: 'tbl_1', name: 'Mesa 1', sortOrder: 2, isActive: true }

    it('lists tables scoped to the restaurant', async () => {
      mockResponse([raw])
      const tables = await client.fetchTables('r1')
      expect(tables).toEqual([mapped])
      expect((globalThis.fetch as any).mock.calls[0][0]).toBe('http://localhost:3001/api/tables?restaurantId=r1')
    })

    it('creates a table sending the restaurant id in the body', async () => {
      mockResponse(raw)
      const table = await client.createTable('Mesa 1', 'r1')
      expect(table).toEqual(mapped)
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/tables?restaurantId=r1')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ name: 'Mesa 1', restaurantId: 'r1' })
    })

    it('updates, reorders and deletes a table', async () => {
      mockResponse({ ...raw, name: 'Terraza', isActive: false })
      const updated = await client.updateTable('tbl_1', { name: 'Terraza', isActive: false }, 'r1')
      expect(updated).toMatchObject({ name: 'Terraza', isActive: false })
      let [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/tables/tbl_1?restaurantId=r1')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body)).toEqual({ name: 'Terraza', isActive: false, restaurantId: 'r1' })

      mockResponse([raw])
      const ordered = await client.reorderTables(['tbl_1'], 'r1')
      expect(ordered).toEqual([mapped]);
      [url, init] = (globalThis.fetch as any).mock.calls[1]
      expect(url).toBe('http://localhost:3001/api/tables/order?restaurantId=r1')
      expect(JSON.parse(init.body)).toEqual({ ids: ['tbl_1'], restaurantId: 'r1' })

      ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: true, status: 204, statusText: 'No Content', json: async () => undefined })
      await client.deleteTable('tbl_1', 'r1')
      ;[url, init] = (globalThis.fetch as any).mock.calls[2]
      expect(url).toBe('http://localhost:3001/api/tables/tbl_1?restaurantId=r1')
      expect(init.method).toBe('DELETE')
    })
  })

  it('should fetch restaurant', async () => {
    const mockData = { id: 'r1', name: 'Burger' }
    mockResponse(mockData)

    const data = await client.fetchRestaurant()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/restaurant', {
      headers: {},
    })
  })

  it('should fetch products', async () => {
    const mockRawData = [{ id: 'p1', name: 'Burger', price: 15000, category: 'Burgers', imageUrl: 'img.png', isAvailable: true }]
    mockResponse(mockRawData)

    const data = await client.fetchProducts()
    expect(data).toEqual([
      {
        id: 'p1',
        name: 'Burger',
        price: 15000,
        category: 'Burgers',
        src: 'img.png',
        description: '',
        inStock: true,
        isPopular: false,
        isNew: false,
        preparationTimeMinutes: undefined,
      },
    ])
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/products', {
      headers: {},
    })
  })

  it('should fetch orders', async () => {
    const mockData = [{ id: 'o1', status: 'pending' }]
    mockResponse(mockData)

    const data = await client.fetchOrders()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders', {
      headers: {},
    })
  })

  it('should fetch inventory', async () => {
    const mockData = [{ id: 'i1', name: 'Buns' }]
    mockResponse(mockData)

    const data = await client.fetchInventory()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/inventory', {
      headers: {},
    })
  })

  it('should create order', async () => {
    const mockData = { id: 'o1' }
    mockResponse(mockData)

    const newOrder: CreateOrderInput = {
      restaurantId: 'rest-1',
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 2, additions: ['cheese'] }],
      deliveryFee: 4500,
    }
    const data = await client.createOrder(newOrder)
    expect(data).toEqual(mockData)
    // createOrder carries a timeout signal so a hung request becomes a
    // retryable failure instead of freezing the checkout.
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
      signal: expect.any(AbortSignal),
    })
  })

  it('should update order status', async () => {
    const mockData = { id: 'o1', status: 'cooking' }
    mockResponse(mockData)

    const data = await client.updateOrderStatus('o1', 'cooking')
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders/o1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cooking' }),
    })
  })

  it('should update inventory stock', async () => {
    const mockData = { id: 'i1', currentStock: 50 }
    mockResponse(mockData)

    const data = await client.updateInventoryStock('i1', 10)
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/inventory/i1/stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityChange: 10 }),
    })
  })

  it('should handle errors', async () => {
    mockResponse(null, false, 404, 'Not Found')
    await expect(client.fetchRestaurant()).rejects.toThrow('API Error: 404 Not Found')
  })

  describe('error body parsing (2.4)', () => {
    const errorOf = async (body: any, status = 400, statusText = 'Bad Request') => {
      mockResponse(body, false, status, statusText)
      return client.createOrder({ restaurantId: 'r', items: [] } as any).catch((e) => e)
    }

    it('exposes the RFC7807 detail as the error message and keeps the status', async () => {
      const err = await errorOf({ title: 'Validation Error', status: 400, detail: 'Subtotal 5000 is below minimum order amount 20000' })
      expect(err.message).toBe('Subtotal 5000 is below minimum order amount 20000')
      expect(err.status).toBe(400)
      expect(err.statusText).toBe('Bad Request')
    })

    it('falls back to message, then error, then the generic status text', async () => {
      expect((await errorOf({ message: 'from message' })).message).toBe('from message')
      expect((await errorOf({ error: 'from error' })).message).toBe('from error')
      const generic = await errorOf({})
      expect(generic.message).toBe('API Error: 400 Bad Request')
      expect(generic.status).toBe(400)
    })

    it('falls back to the generic message when the body is not JSON', async () => {
      const fetchMock = globalThis.fetch as any
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      })
      const err = await client.createOrder({ restaurantId: 'r', items: [] } as any).catch((e) => e)
      expect(err.message).toBe('API Error: 502 Bad Gateway')
      expect(err.status).toBe(502)
    })

    it('aborts createOrder after the submit timeout so the caller can retry with the same id', async () => {
      vi.useFakeTimers()
      try {
        const fetchMock = globalThis.fetch as any
        fetchMock.mockImplementationOnce(
          (_url: string, init: RequestInit) =>
            new Promise((_res, rej) => {
              init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
            })
        )
        const p = client.createOrder({ restaurantId: 'r', items: [] } as any).catch((e) => e)
        await vi.advanceTimersByTimeAsync(ORDER_SUBMIT_TIMEOUT_MS + 1)
        const err = await p
        expect(err.name).toBe('AbortError')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('should list restaurants', async () => {
    const mockData = [{ id: 'r1', name: 'Burger Craft', slug: 'burger-craft' }]
    mockResponse(mockData)

    const data = await client.listRestaurants()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/restaurants', {
      headers: {},
    })
  })

  it('should create restaurant', async () => {
    const mockData = { id: 'r2', name: 'Pizza Hub', slug: 'pizza-hub' }
    mockResponse(mockData)

    const data = await client.createRestaurant({ name: 'Pizza Hub', slug: 'pizza-hub' })
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pizza Hub', slug: 'pizza-hub' }),
    })
  })

  it('should delete restaurant', async () => {
    const mockData = { message: 'Restaurant deleted successfully' }
    mockResponse(mockData)

    const data = await client.deleteRestaurant('r2')
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/restaurants/r2', {
      method: 'DELETE',
      headers: {},
    })
  })

  it('should support subscribeToOrderStream gracefully when EventSource is unavailable', () => {
    const unsub = client.subscribeToOrderStream(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('should fetch additions with query params', async () => {
    const mockData = [{ id: 'add-1', name: 'Queso', price: 2500, isAvailable: true }]
    mockResponse(mockData)

    const data = await client.fetchAdditions('burger-craft')
    expect(data).toEqual([{ id: 'add-1', name: 'Queso', price: 2500, available: true }])
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/additions?slug=burger-craft', {
      headers: {},
    })
  })

  it('should create addition', async () => {
    const mockData = { id: 'add-2', name: 'Tocineta', price: 3500, isAvailable: true }
    mockResponse(mockData)

    const data = await client.createAddition({ name: 'Tocineta', price: 3500 })
    expect(data).toEqual({ id: 'add-2', name: 'Tocineta', price: 3500, available: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/additions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tocineta', price: 3500 }),
    })
  })

  it('should update addition', async () => {
    const mockData = { id: 'add-2', name: 'Tocineta Ahumada', price: 4000, isAvailable: true }
    mockResponse(mockData)

    const data = await client.updateAddition('add-2', { name: 'Tocineta Ahumada', price: 4000, isAvailable: true })
    expect(data).toEqual({ id: 'add-2', name: 'Tocineta Ahumada', price: 4000, available: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/additions/add-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tocineta Ahumada', price: 4000, isAvailable: true }),
    })
  })

  it('should delete addition', async () => {
    mockResponse(undefined)

    await client.deleteAddition('add-2')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/additions/add-2', {
      method: 'DELETE',
      headers: {},
    })
  })

  it('should fetch customers', async () => {
    const mockCustomers = [
      { id: 'c1', name: 'John Doe', phone: '+57 300 123 4567', address: 'Calle 10', barrio: 'Poblado', notes: 'Sin cebolla' }
    ]
    mockResponse(mockCustomers)

    const data = await client.fetchCustomers('rest-1')
    expect(data).toEqual(mockCustomers)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/customers?restaurantId=rest-1', {
      headers: {},
    })
  })

  it('should update customer with PUT and payload', async () => {
    const updatedCustomer = {
      id: 'c1',
      name: 'John Doe Editado',
      phone: '+57 300 999 8888',
      notes: 'Nota importante',
    }
    mockResponse(updatedCustomer)

    const data = await client.updateCustomer('c1', { name: 'John Doe Editado', notes: 'Nota importante' }, 'rest-1')
    expect(data).toEqual(updatedCustomer)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/customers/c1?restaurantId=rest-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe Editado', notes: 'Nota importante', restaurantId: 'rest-1' }),
    })
  })

  it('deleteCustomer sends DELETE /customers/:id scoped to the restaurant', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => undefined,
    })

    await client.deleteCustomer('c1', 'rest-1')
    const [url, init] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toBe('http://localhost:3001/api/customers/c1?restaurantId=rest-1')
    expect(init.method).toBe('DELETE')
  })
})

  describe('subscribeToOrderStream — token refresh & bounded reconnect (JD-CONF-03)', () => {
        const flushMicrotasks = async () => {
          for (let i = 0; i < 12; i += 1) {
            await Promise.resolve()
          }
        }
    class FakeEventSource {
      static instances: FakeEventSource[] = []
      url: string
      closed = false
      listeners: Record<string, Array<(e?: any) => void>> = {}

      constructor(url: string) {
        this.url = url
        FakeEventSource.instances.push(this)
      }

      addEventListener(type: string, listener: (e?: any) => void) {
        if (!this.listeners[type]) this.listeners[type] = []
        this.listeners[type].push(listener)
      }

      close() {
        this.closed = true
      }

      emit(type: string, e?: any) {
        (this.listeners[type] || []).forEach((listener) => listener(e))
      }
    }

    let originalEventSource: any

    afterEach(() => {
      vi.useRealTimers()
      if (originalEventSource !== undefined) {
        (globalThis as any).EventSource = originalEventSource
      }
      FakeEventSource.instances = []
    })

    it('notifies onReconnect only when the stream reopens after a drop, never on first connect (5.8)', async () => {
      vi.useFakeTimers()
      const client = new ApiClient({ baseUrl: 'http://localhost:3001/api' })
      client.setToken('session-token')
      originalEventSource = (globalThis as any).EventSource
      ;(globalThis as any).EventSource = FakeEventSource

      let tokenCalls = 0
      ;(globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/orders/stream-token')) {
          tokenCalls += 1
          return { ok: true, status: 200, json: async () => ({ token: `t-${tokenCalls}` }) }
        }
        return { ok: false, status: 404, json: async () => ({}) }
      })

      const onReconnect = vi.fn()
      const unsub = client.subscribeToOrderStream(() => {}, undefined, onReconnect)
      await flushMicrotasks()

      FakeEventSource.instances[0].emit('open')
      expect(onReconnect).not.toHaveBeenCalled()

      FakeEventSource.instances[0].emit('error')
      await vi.advanceTimersByTimeAsync(1000)
      await flushMicrotasks()
      expect(onReconnect).not.toHaveBeenCalled() // not yet open again

      FakeEventSource.instances[1].emit('open')
      expect(onReconnect).toHaveBeenCalledTimes(1)

      // A later plain open (no drop in between) does not notify again.
      FakeEventSource.instances[1].emit('open')
      expect(onReconnect).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('re-mints a fresh stream token and reopens with bounded backoff after an error', async () => {
      vi.useFakeTimers()
      const client = new ApiClient({ baseUrl: 'http://localhost:3001/api' })
      client.setToken('session-token')

      originalEventSource = (globalThis as any).EventSource
      ;(globalThis as any).EventSource = FakeEventSource

      let tokenCalls = 0
      ;(globalThis.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/orders/stream-token')) {
          tokenCalls += 1
          return { ok: true, status: 200, json: async () => ({ token: `stream-token-${tokenCalls}` }) }
        }
        return { ok: false, status: 404, json: async () => ({}) }
      })

      const unsub = client.subscribeToOrderStream(() => {})
          await flushMicrotasks()

      expect(FakeEventSource.instances).toHaveLength(1)
      expect(FakeEventSource.instances[0].url).toContain('stream-token-1')

      // Stream dies (expired 60s token → 401 → error event).
      FakeEventSource.instances[0].emit('error')

      // First retry after 1s backoff, with a freshly minted token.
      await vi.advanceTimersByTimeAsync(1000)
          await flushMicrotasks()

      expect(FakeEventSource.instances).toHaveLength(2)
      expect(FakeEventSource.instances[1].url).toContain('stream-token-2')
      expect(FakeEventSource.instances[1].url).not.toContain('stream-token-1')

      // A successful open resets the backoff counter.
      FakeEventSource.instances[1].emit('open')
      FakeEventSource.instances[1].emit('error')
      await vi.advanceTimersByTimeAsync(1000)
          await flushMicrotasks()

      expect(FakeEventSource.instances).toHaveLength(3)
      expect(FakeEventSource.instances[2].url).toContain('stream-token-3')
      // Unsubscribe stops any further reconnects.
      unsub()
      FakeEventSource.instances[2].emit('error')
      await vi.advanceTimersByTimeAsync(120_000)
      expect(FakeEventSource.instances).toHaveLength(3)
    })
  })

  describe('user lifecycle endpoints and password change', () => {
    let client: ApiClient
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      client = new ApiClient({ baseUrl: 'http://localhost:3001/api' })
      originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn()
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    const mockResponse = (data: any, ok = true, status = 200, statusText = 'OK') => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok,
        status,
        statusText,
        json: async () => data,
      })
    }

    it('setUserActive sends PATCH /users/:id with isActive body', async () => {
      mockResponse({ id: 'u1', username: 'john', role: 'restaurant_admin', isActive: false })
      const res = await (client as any).setUserActive('u1', false)
      expect(res.isActive).toBe(false)
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/users/u1')
      expect(init.method).toBe('PATCH')
      expect(JSON.parse(init.body)).toEqual({ isActive: false })
    })

    it('deleteUser sends DELETE /users/:id with 204 response', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: async () => undefined,
      })
      await (client as any).deleteUser('u1')
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/users/u1')
      expect(init.method).toBe('DELETE')
    })

    it('resetUserPassword sends POST /users/:id/reset-password', async () => {
      mockResponse({ temporaryPassword: 'temp-secret-pass-123' })
      const res = await (client as any).resetUserPassword('u1')
      expect(res.temporaryPassword).toBe('temp-secret-pass-123')
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/users/u1/reset-password')
      expect(init.method).toBe('POST')
    })

    it('changeOwnPassword sends POST /users/me/password and updates auth token', async () => {
      client.setToken('old-token')
      mockResponse({ success: true, token: 'new-fresh-token' })
      const res = await (client as any).changeOwnPassword('old-pass-1', 'new-pass-2')
      expect(res.success).toBe(true)
      expect(res.token).toBe('new-fresh-token')
      const [url, init] = (globalThis.fetch as any).mock.calls[0]
      expect(url).toBe('http://localhost:3001/api/users/me/password')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ currentPassword: 'old-pass-1', newPassword: 'new-pass-2' })
      expect((client as any).token).toBe('new-fresh-token')
    })

    it('notifies password change required on 403 PASSWORD_CHANGE_REQUIRED response', async () => {
      const listener = vi.fn()
      const unsub = (client as any).onPasswordChangeRequired(listener)

      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change required' }),
      })

      await expect(client.listRestaurants()).rejects.toThrow()
      expect(listener).toHaveBeenCalledTimes(1)

      unsub()
      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ code: 'PASSWORD_CHANGE_REQUIRED' }),
      })
      await expect(client.listRestaurants()).rejects.toThrow()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    describe('session expiration handling', () => {
      it('notifies session expired on 401 response from an authenticated request', async () => {
        client.setToken('valid-token')
        const listener = vi.fn()
        const unsub = (client as any).onSessionExpired(listener)

        ;(globalThis.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Token expired' }),
        })

        await expect(client.listRestaurants()).rejects.toThrow()
        expect(listener).toHaveBeenCalledTimes(1)
        expect(client.getToken()).toBeNull()

        unsub()
      })

      it('does not notify session expired on 401 from login', async () => {
        const listener = vi.fn()
        ;(client as any).onSessionExpired(listener)

        ;(globalThis.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'Invalid credentials' }),
        })

        const res = await client.login('baduser', 'badpass')
        expect(res.success).toBe(false)
        expect(listener).not.toHaveBeenCalled()
      })

      it('ignores 401 when the request was sent with a stale/superseded token', async () => {
        const listener = vi.fn()
        ;(client as any).onSessionExpired(listener)

        client.setToken('old-token')

        ;(globalThis.fetch as any).mockImplementationOnce(async () => {
          client.setToken('new-active-token')
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ message: 'Session expired' }),
          }
        })

        await expect(client.listRestaurants()).rejects.toThrow()
        expect(listener).not.toHaveBeenCalled()
        expect(client.getToken()).toBe('new-active-token')
      })

      it('notifies exactly once on concurrent 401 responses', async () => {
        client.setToken('active-token')
        const listener = vi.fn()
        ;(client as any).onSessionExpired(listener)

        const make401 = () => ({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Session expired' }),
        })

        ;(globalThis.fetch as any)
          .mockResolvedValueOnce(make401())
          .mockResolvedValueOnce(make401())
          .mockResolvedValueOnce(make401())

        await Promise.allSettled([
          client.listRestaurants(),
          client.listRestaurants(),
          client.listRestaurants(),
        ])

        expect(listener).toHaveBeenCalledTimes(1)
        expect(client.getToken()).toBeNull()
      })

      it('stops SSE reconnection when stream token request gets 401', async () => {
        const originalES = (globalThis as any).EventSource
        class FakeES {
          addEventListener = vi.fn()
          close = vi.fn()
        }
        (globalThis as any).EventSource = FakeES

        try {
          client.setToken('active-token')
          const listener = vi.fn()
          const unsubExpired = (client as any).onSessionExpired(listener)

          ;(globalThis.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ message: 'Session expired' }),
          })

          const unsubStream = client.subscribeToOrderStream(() => {})

          await new Promise((r) => setTimeout(r, 50))

          expect(listener).toHaveBeenCalledTimes(1)
          expect(globalThis.fetch).toHaveBeenCalledTimes(1)

          unsubStream()
          unsubExpired()
        } finally {
          (globalThis as any).EventSource = originalES
        }
      })
    })

    describe('User permissions and session preservation (RBAC)', () => {
      it('login preserves user permissions and roleId from backend response', async () => {
        (globalThis.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            token: 'staff-token',
            user: {
              id: 'staff-1',
              username: 'cocinero',
              role: 'restaurant_staff',
              restaurantId: 'rest-1',
              roleId: 'role-kitchen',
              permissions: ['orders.view', 'orders.manage'],
              mustChangePassword: false,
            },
          }),
        })

        const res = await client.login('cocinero', 'secret123')
        expect(res.success).toBe(true)
        expect(res.user?.permissions).toEqual(['orders.view', 'orders.manage'])
        expect(res.user?.roleId).toBe('role-kitchen')
        expect(client.getToken()).toBe('staff-token')
      })

      it('getMe sends GET /users/me and returns user with permissions and roleId', async () => {
        client.setToken('auth-token')
        let requestedUrl = ''
        ;(globalThis.fetch as any).mockImplementationOnce(async (url: string) => {
          requestedUrl = url
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'staff-1',
              username: 'cocinero',
              role: 'restaurant_staff',
              restaurantId: 'rest-1',
              roleId: 'role-kitchen',
              permissions: ['orders.view', 'orders.manage'],
            }),
          }
        })

        const me = await (client as any).getMe()
        expect(requestedUrl).toBe('http://localhost:3001/api/users/me')
        expect(me.username).toBe('cocinero')
        expect(me.permissions).toEqual(['orders.view', 'orders.manage'])
      })
    })
  })

