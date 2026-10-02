import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { ChangePasswordScreen } from "./ChangePasswordScreen"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

describe("ChangePasswordScreen (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders form fields for current, new and confirm password", () => {
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    expect(screen.getByLabelText(/^Contraseña actual$/i)).toBeDefined()
    expect(screen.getByLabelText(/^Nueva contraseña$/i)).toBeDefined()
    expect(screen.getByLabelText(/^Confirmar nueva contraseña$/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Actualizar contraseña|Cambiar contraseña/i })).toBeDefined()
  })

  it("shows inline validation error when new password is under 8 characters", async () => {
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} />
      </RestaurantProvider>
    )

    const newPassInput = screen.getByLabelText(/^Nueva contraseña$/i)
    fireEvent.change(newPassInput, { target: { value: "short1" } })

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeDefined()
  })

  it("shows inline validation error when new password is the same as current password", async () => {
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} />
      </RestaurantProvider>
    )

    const currentPassInput = screen.getByLabelText(/^Contraseña actual$/i)
    const newPassInput = screen.getByLabelText(/^Nueva contraseña$/i)

    fireEvent.change(currentPassInput, { target: { value: "samepassword123" } })
    fireEvent.change(newPassInput, { target: { value: "samepassword123" } })

    expect(await screen.findByText(/debe ser diferente a la actual/i)).toBeDefined()
  })

  it("shows inline validation error when confirm password does not match new password", async () => {
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} />
      </RestaurantProvider>
    )

    const newPassInput = screen.getByLabelText(/^Nueva contraseña$/i)
    const confirmPassInput = screen.getByLabelText(/^Confirmar nueva contraseña$/i)

    fireEvent.change(newPassInput, { target: { value: "newsecretpassword1" } })
    fireEvent.change(confirmPassInput, { target: { value: "mismatchpass2" } })

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeDefined()
  })

  it("in forced mode, displays clear warning that password change is required and provides logout", () => {
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={true} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Cambio de contraseña obligatorio/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Cerrar sesión/i })).toBeDefined()
    expect(screen.queryByRole("button", { name: /Cancelar/i })).toBeNull()
  })

  it("submits valid password change and calls changeOwnPassword", async () => {
    const changeSpy = vi.spyOn(apiClient, "changeOwnPassword").mockResolvedValue({
      success: true,
      token: "new-token-after-change",
    })

    const onSuccess = vi.fn()
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={true} onSuccess={onSuccess} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Contraseña actual$/i), {
      target: { value: "old-temporary-pass" },
    })
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña$/i), {
      target: { value: "brand-new-pass-123" },
    })
    fireEvent.change(screen.getByLabelText(/^Confirmar nueva contraseña$/i), {
      target: { value: "brand-new-pass-123" },
    })

    const submitBtn = screen.getByRole("button", { name: /Actualizar contraseña|Cambiar contraseña/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith("old-temporary-pass", "brand-new-pass-123")
    })
  })
})
