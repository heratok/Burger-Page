import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CreateOrderInput } from '@burger-page/contracts'
import { ApiClient } from './apiClient'

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
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok,
      status,
      statusText,
      json: async () => data,
    })
  }

  it('should fetch restaurant', async () => {
    const mockData = { id: 'r1', name: 'Burger' }
    mockResponse(mockData)

    const data = await client.fetchRestaurant()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/restaurant', {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('should fetch products', async () => {
    const mockData = [{ id: 'p1', name: 'Burger' }]
    mockResponse(mockData)

    const data = await client.fetchProducts()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/products', {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('should fetch orders', async () => {
    const mockData = [{ id: 'o1', status: 'pending' }]
    mockResponse(mockData)

    const data = await client.fetchOrders()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders', {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('should fetch inventory', async () => {
    const mockData = [{ id: 'i1', name: 'Buns' }]
    mockResponse(mockData)

    const data = await client.fetchInventory()
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/inventory', {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('should create order', async () => {
    const mockData = { id: 'o1' }
    mockResponse(mockData)

    const newOrder: CreateOrderInput = {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 2, additions: ['cheese'] }],
      deliveryFee: 4500,
    }
    const data = await client.createOrder(newOrder)
    expect(data).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
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

  it('should support subscribeToOrderStream gracefully when EventSource is unavailable', () => {
    const unsub = client.subscribeToOrderStream(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })
})
