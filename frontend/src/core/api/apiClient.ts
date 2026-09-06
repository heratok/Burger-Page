import {
  RestaurantRecord,
  MenuItem,
  Order,
  OrderStatus,
  InventoryItem,
  AdditionItem,
} from '@/types/restaurant'
import type { OrderEvent, CreateOrderInput, CreateRestaurantInput, UpdateRestaurantInput } from '@burger-page/contracts'

export interface ApiClientConfig {
  baseUrl: string
}

function mapProductResponse(raw: any): MenuItem {
  return {
    id: raw.id,
    name: raw.name,
    price: Number(raw.price || 0),
    category: raw.category,
    src: raw.imageUrl || '',
    description: raw.description || '',
    inStock: raw.isAvailable !== undefined ? Boolean(raw.isAvailable) : true,
    isPopular: Boolean(raw.isPopular),
    isNew: Boolean(raw.isNew),
    preparationTimeMinutes: raw.preparationTimeMinutes,
  }
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

  hasToken(): boolean {
    return Boolean(this.token)
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

    if (response.status === 204 || response.status === 205) {
      return undefined as T
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

  async updateRestaurant(id: string, data: UpdateRestaurantInput): Promise<RestaurantRecord> {
    return this.request<RestaurantRecord>(`/restaurants/${id}`, {
      method: 'PUT',
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

  async fetchProducts(params?: { restaurantId?: string; slug?: string }): Promise<MenuItem[]> {
    const query = new URLSearchParams()
    if (params?.restaurantId) query.set('restaurantId', params.restaurantId)
    if (params?.slug) query.set('slug', params.slug)
    const qs = query.toString() ? `?${query.toString()}` : ''
    const raw = await this.request<any[]>(`/products${qs}`)
    return Array.isArray(raw) ? raw.map(mapProductResponse) : []
  }

  async createProduct(data: {
    restaurantId?: string
    name: string
    description?: string
    price: number
    category: string
    imageUrl?: string
    isAvailable?: boolean
    isPopular?: boolean
    isNew?: boolean
    preparationTimeMinutes?: number
  }): Promise<MenuItem> {
    const raw = await this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return mapProductResponse(raw)
  }

  async updateProduct(id: string, data: Partial<{
    name: string
    description: string
    price: number
    category: string
    imageUrl: string
    isAvailable: boolean
    isPopular: boolean
    isNew: boolean
    preparationTimeMinutes: number
    restaurantId: string
  }>, restaurantId?: string): Promise<MenuItem> {
    const targetRest = restaurantId || data.restaurantId
    const qs = targetRest ? `?restaurantId=${encodeURIComponent(targetRest)}` : ''
    const payload = targetRest && !data.restaurantId ? { ...data, restaurantId: targetRest } : data
    const raw = await this.request<any>(`/products/${id}${qs}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return mapProductResponse(raw)
  }

  async deleteProduct(id: string, restaurantId?: string): Promise<void> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    await this.request<void>(`/products/${id}${qs}`, {
      method: 'DELETE',
    })
  }

  async fetchAdditions(
    target?: { restaurantId?: string; slug?: string; productId?: string } | string,
    productId?: string
  ): Promise<AdditionItem[]> {
    const params = new URLSearchParams()
    if (typeof target === 'object' && target !== null) {
      if (target.restaurantId) params.set('restaurantId', target.restaurantId)
      if (target.slug) params.set('slug', target.slug)
      if (target.productId) params.set('productId', target.productId)
    } else if (typeof target === 'string') {
      if (target.startsWith('rest-') || target.startsWith('tenant-')) {
        params.set('restaurantId', target)
      } else {
        params.set('slug', target)
      }
      if (productId) {
        params.set('productId', productId)
      }
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

  async createAddition(data: { name: string; price: number; isAvailable?: boolean; displayOrder?: number; productId?: string; restaurantId?: string }): Promise<AdditionItem> {
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

  async updateAddition(
    id: string,
    data: Partial<{ name: string; price: number; isAvailable: boolean; displayOrder: number; productId?: string; restaurantId?: string }>,
    restaurantId?: string
  ): Promise<AdditionItem> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    const payload = restaurantId && !data.restaurantId ? { ...data, restaurantId } : data
    const raw = await this.request<any>(`/additions/${id}${qs}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return {
      id: raw.id,
      name: raw.name,
      price: Number(raw.price || 0),
      available: raw.isAvailable !== undefined ? Boolean(raw.isAvailable) : true,
    }
  }

  async deleteAddition(id: string, restaurantId?: string): Promise<void> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    await this.request<void>(`/additions/${id}${qs}`, {
      method: 'DELETE',
    })
  }

  async createOrder(orderInput: CreateOrderInput): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderInput),
    })
  }

  async fetchOrders(restaurantId?: string): Promise<Order[]> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    return this.request<Order[]>(`/orders${qs}`)
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, restaurantId?: string): Promise<Order> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    return this.request<Order>(`/orders/${orderId}/status${qs}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async updateOrderReceipt(orderId: string, receiptUrl: string, restaurantId?: string): Promise<Order> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    return this.request<Order>(`/orders/${orderId}/receipt${qs}`, {
      method: 'PATCH',
      body: JSON.stringify({ receiptUrl }),
    })
  }

  async fetchInventory(restaurantId?: string): Promise<InventoryItem[]> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    return this.request<InventoryItem[]>(`/inventory${qs}`)
  }

  async createInventoryItem(data: {
    restaurantId?: string
    name: string
    category?: string
    quantity: number
    unit: string
    minStockAlert?: number
    alertThreshold?: number
    costPerUnit?: number
  }): Promise<InventoryItem> {
    return this.request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInventoryItem(
    id: string,
    data: Partial<{
      restaurantId?: string
      name: string
      category: string
      quantity: number
      unit: string
      minStockAlert: number
      alertThreshold: number
      costPerUnit: number
    }>,
    restaurantId?: string
  ): Promise<InventoryItem> {
    const targetRest = restaurantId || data.restaurantId
    const qs = targetRest ? `?restaurantId=${encodeURIComponent(targetRest)}` : ''
    const payload = targetRest && !data.restaurantId ? { ...data, restaurantId: targetRest } : data
    return this.request<InventoryItem>(`/inventory/${id}${qs}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async deleteInventoryItem(id: string, restaurantId?: string): Promise<void> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    await this.request<void>(`/inventory/${id}${qs}`, {
      method: 'DELETE',
    })
  }

  async updateInventoryStock(itemId: string, quantityChange: number, restaurantId?: string): Promise<InventoryItem> {
    const qs = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
    return this.request<InventoryItem>(`/inventory/${itemId}/stock${qs}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantityChange }),
    })
  }

  /**
   * Subscribes to real-time Server-Sent Events (SSE) for live order updates.
   * Returns an unsubscribe function.
   */
  subscribeToOrderStream(onEvent: (event: OrderEvent) => void, restaurantId?: string): () => void {
    if (typeof EventSource === 'undefined') {
      return () => {}
    }

    const params = new URLSearchParams()
    if (this.token) params.set('token', this.token)
    if (restaurantId) params.set('restaurantId', restaurantId)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const eventSource = new EventSource(`${this.baseUrl}/orders/stream${qs}`)

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
    eventSource.addEventListener('ORDER_RECEIPT_UPDATED', handleMessage as EventListener)

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

  async getPresignedUploadUrl(params: {
    restaurantId?: string
    folder?: 'products' | 'branding' | 'general'
    filename?: string
  }): Promise<{
    mode: 'signed_url' | 'local_fallback'
    uploadUrl?: string
    token?: string
    path: string
    publicUrl?: string
  }> {
    return this.request('/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }
}

export const apiClient = new ApiClient()
