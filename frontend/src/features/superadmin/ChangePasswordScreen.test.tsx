import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { ChangePasswordScreen } from "./ChangePasswordScreen"
import { AdminAuthModal } from "./AdminAuthModal"
import AdditionsModal from "@/features/cart/AdditionsModal"
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

  it("shows Spanish error inline once and no toast when current password is incorrect", async () => {
    const { toast } = await import("sonner")
    const toastErrorSpy = vi.spyOn(toast, "error")

    const error400: any = new Error("Current password is incorrect")
    error400.status = 400
    vi.spyOn(apiClient, "changeOwnPassword").mockRejectedValue(error400)

    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Contraseña actual$/i), {
      target: { value: "wrong-current-pass" },
    })
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña$/i), {
      target: { value: "brand-new-pass-123" },
    })
    fireEvent.change(screen.getByLabelText(/^Confirmar nueva contraseña$/i), {
      target: { value: "brand-new-pass-123" },
    })

    const submitBtn = screen.getByRole("button", { name: /Actualizar contraseña|Cambiar contraseña/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText("La contraseña actual es incorrecta")).toBeDefined()
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  it("renders accessible dialog in voluntary mode with role=dialog, aria-modal and closes on Escape", () => {
    const onClose = vi.fn()
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={false} onClose={onClose} />
      </RestaurantProvider>
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute("aria-modal")).toBe("true")

    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})

// S11 — the forced screen renders straight from App.tsx, outside AdminLayout,
// so it must own the theme root and its heading colour must never depend on a
// `.dark` ancestor that only AdminLayout installs.
describe("ChangePasswordScreen forced mode theme ownership (S11)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  const headingClasses = (name: RegExp) =>
    screen.getByRole("heading", { name }).className.split(/\s+/).filter(Boolean)

  it("uses a literal light heading colour and installs its own dark root in dark theme", () => {
    localStorage.setItem("burger_page_admin_theme_v2", "dark")
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={true} />
      </RestaurantProvider>
    )

    const heading = screen.getByRole("heading", { name: /Cambio de contraseña obligatorio/i })
    const classes = headingClasses(/Cambio de contraseña obligatorio/i)

    // No `dark:` colour variant: it only resolves when an ancestor carries `.dark`.
    expect(classes.filter((c) => c.startsWith("dark:"))).toEqual([])
    expect(classes).toContain("text-white")
    // The screen applies its own theme root for the same reason.
    expect(heading.closest(".dark")).not.toBeNull()
  })

  it("keeps a dark heading colour when the admin theme is light", () => {
    localStorage.setItem("burger_page_admin_theme_v2", "light")
    render(
      <RestaurantProvider>
        <ChangePasswordScreen isForced={true} />
      </RestaurantProvider>
    )

    const classes = headingClasses(/Cambio de contraseña obligatorio/i)
    expect(classes.filter((c) => c.startsWith("dark:"))).toEqual([])
    expect(classes).toContain("text-slate-900")
  })
})

// S12 — dead blur. The modal test files for these two surfaces are owned by
// other writers, so the guards live here with the rest of the blur sweep.
describe("S12 — no backdrop blur on opaque or static surfaces", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  const tokens = (element: Element | null) => (element?.className ?? "").split(/\s+/).filter(Boolean)

  it("removes blur from the AdditionsModal close button that floats over the opaque panel", () => {
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={{
            id: "prod-blur",
            name: "Tenders Crispy x4",
            price: 22900,
            category: "Tenders",
            src: "https://example.com/tenders.jpg",
            description: "Tenders de pechuga de pollo crispy.",
            inStock: true,
          }}
          onClose={vi.fn()}
          onAddToCart={vi.fn()}
        />
      </RestaurantProvider>
    )

    const closeButton = screen.getByRole("button", { name: "Cerrar" })
    const closeTokens = tokens(closeButton)

    expect(closeTokens.filter((c) => c.includes("backdrop-blur"))).toEqual([])
    // Everything else about the control stays identical.
    expect(closeTokens).toContain("bg-bg-elevated")
    expect(closeTokens).toContain("rounded-full")

    // Blur over the hero image is not dead: it still sits on a photo.
    const photoButton = screen.getByRole("button", { name: "Ampliar imagen" })
    expect(tokens(photoButton)).toContain("backdrop-blur-md")
  })

  it("keeps AdminAuthModal free of backdrop blur across brand, pillars, and login card", () => {
    const { container } = render(
      <RestaurantProvider>
        <AdminAuthModal isOpen />
      </RestaurantProvider>
    )

    expect(screen.getAllByText(/FoodOS/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("heading", { name: /Iniciar Sesión/i })).toBeTruthy()

    const blurredElements = Array.from(container.querySelectorAll("*")).filter((el) =>
      Array.from(el.classList).some((c) => c.includes("backdrop-blur"))
    )
    expect(blurredElements).toEqual([])
  })
})
