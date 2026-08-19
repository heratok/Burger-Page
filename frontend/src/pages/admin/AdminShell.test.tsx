import { afterEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import AdminShell from "./AdminShell"
import { AdminProvider } from "@/store/AdminContext"
import { SUPER_ADMIN_GRANT_KEY, adminGrantKey } from "@/store/admin-context"
import { storage } from "@/lib/storage"

// Controlled mobile flag so the desktop and mobile shell behaviours can be
// exercised independently (design AS-2).
const { isMobile } = vi.hoisted(() => ({ isMobile: { current: false } }))
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile.current,
}))

afterEach(() => {
  isMobile.current = false
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.removeAttribute("style")
})

function renderShell(initialEntry = "/admin") {
  return render(
    <AdminProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<div>INDEX-SLOT</div>} />
            <Route path="products" element={<div>PRODUCTS-SLOT</div>} />
            <Route path="orders" element={<div>ORDERS-SLOT</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AdminProvider>
  )
}

function seedOrders(restaurantId: string, statuses: string[]) {
  const repo = storage.getRepositoryFor(restaurantId)
  for (const status of statuses) {
    repo.saveOrder({
      items: [],
      customer: {
        nombre: "Cliente",
        telefono: "3001112222",
        direccion: "Calle 1 #2-3",
        barrio: "Centro",
      },
      metodo: "Efectivo",
      total: 10000,
    })
    const last = repo.listOrders()[repo.listOrders().length - 1]
    repo.updateOrderStatus(last.id, status as never)
  }
}

describe("AdminShell nav (AS-1)", () => {
  it("shows the restaurant sections and never a Ventas entry for a restaurant session", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderShell()

    expect(screen.getByRole("link", { name: /Resumen/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Productos/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Pedidos/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Configuración/ })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Ventas/ })).toBeNull()
    expect(screen.queryByRole("link", { name: /Restaurantes/ })).toBeNull()
  })

  it("shows the super sections for a super session", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderShell()

    expect(screen.getByRole("link", { name: /Resumen global/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Restaurantes/ })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Contraseña/ })).toBeTruthy()
  })
})

describe("AdminShell pending badge (AS-1)", () => {
  it("shows the pending count on Pedidos when new/confirmed orders exist", async () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    // new/confirmed are pending; cancelled is not. delivered is unreachable in a
    // single transition (canTransition new->delivered is false), so it is
    // omitted here to keep the pending count deterministic at 3.
    seedOrders("rest-pizza-roma", ["new", "new", "confirmed", "cancelled"])
    renderShell()

    const pedidos = await screen.findByRole("link", { name: /Pedidos/ })
    expect(within(pedidos).getByText("3")).toBeTruthy()
  })

  it("does not show a badge when there are no pending orders", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderShell()

    const pedidos = screen.getByRole("link", { name: /^Pedidos$/ })
    expect(within(pedidos).queryByText(/\d/)).toBeNull()
  })
})

describe("AdminShell desktop collapse (AS-2)", () => {
  it("collapses to the icon rail and restores on toggle", async () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderShell()

    const sidebar = document.querySelector('[data-slot="sidebar"]')
    expect(sidebar?.getAttribute("data-state")).toBe("expanded")

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }))
    await waitFor(() =>
      expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
    )

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }))
    await waitFor(() =>
      expect(sidebar?.getAttribute("data-state")).toBe("expanded")
    )
  })
})

describe("AdminShell mobile drawer (AS-2)", () => {
  it("opens a drawer on mobile and closes it when a section is selected", async () => {
    isMobile.current = true
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderShell()

    // Drawer is closed initially: the nav sections are not rendered on mobile.
    expect(screen.queryByRole("link", { name: /Restaurantes/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }))
    const restaurants = await screen.findByRole("link", { name: /Restaurantes/ })

    act(() => {
      fireEvent.click(restaurants)
    })

    // Selecting a section closes the drawer on mobile.
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Restaurantes/ })).toBeNull()
    )
  })
})
