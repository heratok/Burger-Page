import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type {
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"
import { AdminProvider } from "@/store/AdminContext"
import { ADMIN_GRANT_KEY } from "@/store/admin-context"
import AdminGate from "./AdminGate"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
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

function renderGate(repo: RestaurantRepository) {
  return render(
    <AdminProvider>
      <AdminGate repo={repo}>
        <div>Contenido admin</div>
      </AdminGate>
    </AdminProvider>
  )
}

describe("AdminGate", () => {
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
    expect(sessionStorage.getItem(ADMIN_GRANT_KEY)).toBeNull()
  })

  it("grants session access on the correct password and shows admin content", () => {
    renderGate(createGateRepo("admin"))

    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "admin" },
    })
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(sessionStorage.getItem(ADMIN_GRANT_KEY)).toBe("1")
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

  it("renders children immediately when a session grant already exists", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    renderGate(createGateRepo())

    expect(screen.getByText("Contenido admin")).toBeTruthy()
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull()
  })
})