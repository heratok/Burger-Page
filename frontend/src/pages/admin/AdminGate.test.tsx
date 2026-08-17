import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import { LocalStorageRepository } from "@/lib/storage"
import { AdminProvider } from "@/store/AdminContext"
import { SUPER_ADMIN_GRANT_KEY, adminGrantKey } from "@/store/admin-context"
import AdminGate from "./AdminGate"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

function createGateRepo(password = "admin"): RestaurantRepository {
  return {
    getConfig: () => ({ adminPassword: password }) as RestaurantConfig,
    saveConfig: vi.fn(),
    listProducts: () => [] as Product[],
    saveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    listModifiers: () => [] as Modifier[],
    saveModifier: vi.fn(),
    deleteModifier: vi.fn(),
    listOrders: () => [] as Order[],
    saveOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
  }
}

function renderGate(
  repo: RestaurantRepository,
  restaurantId = "rest-pizza-roma"
) {
  return render(
    <AdminProvider>
      <AdminGate restaurantId={restaurantId} repo={repo}>
        <div>Contenido admin</div>
      </AdminGate>
    </AdminProvider>
  )
}

describe("AdminGate (mode-aware, AD-1)", () => {
  it("shows the password prompt and keeps admin content hidden when not granted", () => {
    renderGate(createGateRepo())

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
  })

  it("rejects a wrong password with an error and grants nothing", () => {
    renderGate(createGateRepo("admin"))

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreto123" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/contraseña incorrecta/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
  })

  it("grants a scoped session on the correct password for the requested restaurant", () => {
    renderGate(createGateRepo("roma"), "rest-pizza-roma")

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "roma" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBe("1")
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("compares against the scoped repository password, not a global one", () => {
    const directory = new LocalStorageRepository(window.localStorage)
    const roma = directory.getBySlug("pizza-roma")
    if (!roma) throw new Error("seed missing pizza-roma")
    renderGate(directory.getRepositoryFor(roma.id), roma.id)

    // burger-page's password ("admin") must NOT open roma's gate ("roma").
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "admin" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
    expect(sessionStorage.getItem(adminGrantKey(roma.id))).toBeNull()
  })

  it("clears the error when the user types again after a failed attempt", () => {
    renderGate(createGateRepo("admin"))

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "nope" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))
    expect(screen.getByRole("alert")).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "a" },
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("renders children when a session grant already exists for this restaurant", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    renderGate(createGateRepo(), "rest-pizza-roma")

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  })

  it("does NOT grant access with a session for a different restaurant (AD-1 Scoped)", () => {
    sessionStorage.setItem(adminGrantKey("rest-sushi-tokio"), "1")
    renderGate(createGateRepo(), "rest-pizza-roma")

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
  })

  it("does not grant access with a super session (restaurant gates stay restaurant-scoped)", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderGate(createGateRepo(), "rest-pizza-roma")

    expect(screen.getByLabelText(/contraseña/i)).toBeTruthy()
    expect(screen.queryByText("Contenido admin")).toBeNull()
  })
})