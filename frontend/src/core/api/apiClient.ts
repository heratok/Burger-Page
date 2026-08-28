import {
  RestaurantRecord,
  MenuItem,
  Order,
  OrderStatus,
  InventoryItem,
} from '@/types/restaurant'
import type { OrderEvent, CreateOrderInput } from '@burger-page/contracts'

export interface ApiClientConfig {
  baseUrl: string
}

export class ApiClient {
  private baseUrl: string

  constructor(config?: ApiClientConfig) {
    const rawUrl = import.meta.env.BACKEND_API_URL || import.meta.env.VITE_API_URL
    this.baseUrl = config?.baseUrl || (rawUrl ? rawUrl.replace(/\/$/, '') : '/api')
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  async fetchRestaurant(): Promise<RestaurantRecord> {
    return this.request<RestaurantRecord>('/restaurant')
  }

  async fetchProducts(): Promise<MenuItem[]> {
    return this.request<MenuItem[]>('/products')
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
}

export const apiClient = new ApiClient()
