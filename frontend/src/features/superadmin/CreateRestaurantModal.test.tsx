import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { CreateRestaurantModal } from "./CreateRestaurantModal"
import { apiClient } from "@/core/api/apiClient"

describe("CreateRestaurantModal (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders form fields correctly when open", () => {
    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Dar de Alta Nuevo Restaurante/i)).toBeDefined()
    expect(screen.getByLabelText(/Nombre del Restaurante/i)).toBeDefined()
    expect(screen.getByLabelText(/Slug \/ URL Pública/i)).toBeDefined()
    expect(screen.getByLabelText(/Usuario Admin/i)).toBeDefined()
    expect(screen.getByLabelText(/Clave Admin/i)).toBeDefined()
  })

  it("validates that admin password must be at least 8 characters if provided", async () => {
    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Clave Admin/i), {
      target: { value: "short" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/La contraseña debe tener al menos 8 caracteres/i)
    ).toBeDefined()
  })

  it("surfaces returned admin credentials with copy buttons once restaurant is created", async () => {
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-new-123",
      slug: "burger-queen",
      name: "Burger Queen",
      adminUsername: "admin_burgerqueen",
      adminPassword: "generatedTempPass123",
    } as any)

    const onCloseMock = vi.fn()

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={onCloseMock} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Clave Admin/i), {
      target: { value: "securePassword123" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled()
    })

    // Credentials screen should be shown
    expect(await screen.findByText(/Credenciales del Administrador/i)).toBeDefined()
    expect(screen.getByText("admin_burgerqueen")).toBeDefined()
    expect(screen.getByText("generatedTempPass123")).toBeDefined()
    expect(screen.getByText(/Esta es la única vez que se mostrará/i)).toBeDefined()

    // Finish button should close the modal
    const closeBtn = screen.getByRole("button", { name: /Entendido y Cerrar/i })
    fireEvent.click(closeBtn)
    expect(onCloseMock).toHaveBeenCalled()
  })

  it("handles 409 conflict when admin username is taken and allows editing username", async () => {
    const error409: any = new Error("Username already exists")
    error409.status = 409

    vi.spyOn(apiClient, "createRestaurant").mockRejectedValue(error409)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Usuario Admin/i), {
      target: { value: "taken_user" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/El nombre de usuario administrador ya está en uso/i)
    ).toBeDefined()

    // Preserves values in form so user can edit
    expect((screen.getByLabelText(/Usuario Admin/i) as HTMLInputElement).value).toBe("taken_user")
  })
})
