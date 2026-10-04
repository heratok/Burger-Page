import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act, waitFor } from "@testing-library/react"
import { RestaurantProvider, useOrders, useTenant } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { apiClient } from "@/core/api/apiClient"
import { appQueryClient } from "@/core/query/queryClient"
import { keys } from "@/core/query/keys"
import { seedBlankActiveTenant } from "@/test/fixtures"
import type { OrderBoard } from "@/context/slices/orderBoard"

// Counts Home's own renders: useStoreStatusRefresh is only called by Home.
const renders = vi.hoisted(() => ({ home: 0 }))
vi.mock("@/hooks/useStoreStatusRefresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useStoreStatusRefresh")>()
  return {
    ...actual,
    useStoreStatusRefresh: (...args: Parameters<typeof actual.useStoreStatusRefresh>) => {
      renders.home += 1
      return actual.useStoreStatusRefresh(...args)
    },
  }
})

const TENANT = "rest-burger-craft"

describe("order activity does not re-render the storefront", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    seedBlankActiveTenant()
    renders.home = 0
  })

  it("placing an order and later order changes leave Home and the tenant record untouched", async () => {
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({ id: "srv-1", orderNumber: 77 } as any)
    let orders!: ReturnType<typeof useOrders>
    let tenant!: ReturnType<typeof useTenant>
    const Driver = () => {
      orders = useOrders()
      tenant = useTenant()
      return null
    }
    render(
      <RestaurantProvider>
        <Home />
        <Driver />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    await act(() => new Promise((r) => setTimeout(r, 20)))
    const before = { renders: renders.home, activeRestaurant: tenant.activeRestaurant }

    let placed!: ReturnType<typeof orders.addOrder>
    act(() => {
      placed = orders.addOrder({
        customer: { nombre: "Cliente Web", telefono: "3001112222", direccion: "Calle 1", barrio: "Centro" },
        items: [],
        total: 10000,
        deliveryFee: 0,
        finalTotal: 10000,
        metodo: "Efectivo",
        status: "pending",
      })
    })
    await placed.serverPromise
    await waitFor(() => expect(orders.orders.map((o) => o.id)).toEqual(["srv-1"]))

    // A later change of the board (e.g. an SSE event or a refetch).
    act(() => {
      appQueryClient.setQueryData<OrderBoard>(keys.orders(TENANT, "guest"), (board) => ({
        ...board!,
        orders: board!.orders.map((o) => ({ ...o, status: "cooking" as const })),
      }))
    })
    expect(orders.orders[0].status).toBe("cooking")

    expect(renders.home).toBe(before.renders)
    expect(tenant.activeRestaurant).toBe(before.activeRestaurant)
  })
})
