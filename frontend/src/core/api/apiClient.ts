import {
  RestaurantRecord,
  MenuItem,
  Order,
  OrderStatus,
  InventoryItem,
  AdditionItem,
} from '@/types/restaurant'
import type { OrderEvent, CreateOrderInput, CreateRestaurantInput } from '@burger-page/contracts'

export interface ApiClientConfig {
  baseUrl: string
}

const AUTH_TOKEN_STORAGE_KEY = 'burger_page_auth_token_v2'

function readStoredToken(): string | null {
  try {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null
  } catch {
    return null
  }
}

export class ApiClient {
  private baseUrl: string
  private token: string | null

  constructor(config?: ApiClientConfig) {
    const rawUrl =
      import.meta.env.PUBLIC_API_URL ||
      import.meta.env.BACKEND_API_URL ||
      import.meta.env.VITE_API_URL

    let resolvedUrl = rawUrl ? rawUrl.replace(/\/$/, '') : ''
    if (resolvedUrl && !resolvedUrl.endsWith('/api')) {
      resolvedUrl = `${resolvedUrl}/api`
    }

    this.baseUrl =
      config?.baseUrl ||
      (resolvedUrl
        ? resolvedUrl
        : typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/api`
        : 'http://localhost:3001/api')

    this.token = readStoredToken()
  }

  setToken(token: string | null): void {
    this.token = token
    try {
      if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return
      if (token) {
        sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
      } else {
        sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      }
    } catch {
      // sessionStorage unavailable (private mode, SSR, tests) — token stays in-memory only
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    }
    if (options?.body) {
      headers['Content-Type'] = 'application/json'
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  async fetchRestaurant(slug?: string): Promise<RestaurantRecord> {
    const endpoint = slug ? `/restaurants/${slug}` : '/restaurant'
    return this.request<RestaurantRecord>(endpoint)
  }

  async listRestaurants(): Promise<RestaurantRecord[]> {
    return this.request<RestaurantRecord[]>('/restaurants')
  }

  async createRestaurant(data: CreateRestaurantInput): Promise<RestaurantRecord> {
    return this.request<RestaurantRecord>('/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteRestaurant(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/restaurants/${id}`, {
      method: 'DELETE',
    })
  }

  async updateCategories(categories: string[], slug?: string): Promise<{ categories: string[] }> {
    const endpoint = slug ? `/restaurant/${slug}/categories` : '/restaurant/categories'
    return this.request<{ categories: string[] }>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    })
  }

  async fetchProducts(): Promise<MenuItem[]> {
    return this.request<MenuItem[]>('/products')
  }

  async fetchAdditions(restaurantIdOrSlug?: string, productId?: string): Promise<AdditionItem[]> {
    const params = new URLSearchParams()
    if (restaurantIdOrSlug) {
      if (restaurantIdOrSlug.startsWith('rest-') || restaurantIdOrSlug.startsWith('tenant-')) {
        params.set('restaurantId', restaurantIdOrSlug)
      } else {
        params.set('slug', restaurantIdOrSlug)
      }
    }
    if (productId) {
      params.set('productId', productId)
    }
    const query = params.toString() ? `?${params.toString()}` : ''
    const raw = await this.request<any[]>(`/additions${query}`)
    return (raw || []).map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      available: item.isAvailable !== undefined ? Boolean(item.isAvailable) : Boolean(item.available ?? true),
    }))
  }

  async createAddition(data: { name: string; price: number; isAvailable?: boolean; displayOrder?: number; productId?: string }): Promise<AdditionItem> {
    const raw = await this.request<any>('/additions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      id: raw.id,
      name: raw.name,
      price: Number(raw.price || 0),
      available: raw.isAvailable !== undefined ? Boolean(raw.isAvailable) : true,
    }
  }

  async updateAddition(id: string, data: Partial<{ name: string; price: number; isAvailable: boolean; displayOrder: number; productId?: string }>): Promise<AdditionItem> {
    const raw = await this.request<any>(`/additions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return {
      id: raw.id,
      name: raw.name,
      price: Number(raw.price || 0),
      available: raw.isAvailable !== undefined ? Boolean(raw.isAvailable) : true,
    }
  }

  async deleteAddition(id: string): Promise<void> {
    await this.request<void>(`/additions/${id}`, {
      method: 'DELETE',
    })
  }

  async createOrder(orderInput: CreateOrderInput): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderInput),
    })
  }

  async fetchOrders(): Promise<Order[]> {
    return this.request<Order[]>('/orders')
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async fetchInventory(): Promise<InventoryItem[]> {
    return this.request<InventoryItem[]>('/inventory')
  }

  async updateInventoryStock(itemId: string, quantityChange: number): Promise<InventoryItem> {
    return this.request<InventoryItem>(`/inventory/${itemId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantityChange }),
    })
  }

  /**
   * Subscribes to real-time Server-Sent Events (SSE) for live order updates.
   * Returns an unsubscribe function.
   */
  subscribeToOrderStream(onEvent: (event: OrderEvent) => void): () => void {
    if (typeof EventSource === 'undefined') {
      return () => {}
    }

    const eventSource = new EventSource(`${this.baseUrl}/orders/stream`)

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as OrderEvent
        onEvent(data)
      } catch {
        // Ignore parse errors on ping/keep-alive frames
      }
    }

    eventSource.addEventListener('ORDER_CREATED', handleMessage as EventListener)
    eventSource.addEventListener('ORDER_STATUS_UPDATED', handleMessage as EventListener)
    eventSource.addEventListener('ORDER_CANCELLED', handleMessage as EventListener)

    return () => {
      eventSource.close()
    }
  }

  async login(username: string, password: string): Promise<{
    success: boolean
    token?: string
    user?: { id: string; username: string; role: string; restaurantId?: string }
    error?: string
  }> {
    const result = await this.request<{
      success: boolean
      token?: string
      user?: { id: string; username: string; role: string; restaurantId?: string }
      error?: string
    }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (result.token) {
      this.setToken(result.token)
    }
    return result
  }

  async createUser(data: {
    username: string
    password: string
    role: 'super_admin' | 'restaurant_admin'
    restaurantId?: string
  }): Promise<{ id: string; username: string; role: string; restaurantId?: string }> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listUsers(restaurantId?: string): Promise<Array<{
    id: string
    username: string
    role: string
    restaurantId?: string
    createdAt: string
  }>> {
    const query = restaurantId ? `?restaurantId=${restaurantId}` : ''
    return this.request(`/users${query}`)
  }
}

export const apiClient = new ApiClient()
