import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { ResetPasswordModal } from "./ResetPasswordModal"
import { toast } from "sonner"

describe("ResetPasswordModal (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders username, temporary password and explicit close button", () => {
    render(
      <ResetPasswordModal
        isOpen={true}
        onClose={vi.fn()}
        username="john_doe"
        temporaryPassword="TempPass123!"
      />
    )

    expect(screen.getByText(/Contraseña Restablecida/i)).toBeDefined()
    expect(screen.getByText(/john_doe/)).toBeDefined()
    expect(screen.getByText("TempPass123!")).toBeDefined()
    expect(screen.getByRole("button", { name: /Ya la copié, cerrar/i })).toBeDefined()
  })

  it("shows success state and toast when clipboard writeText succeeds", async () => {
    const toastSuccessSpy = vi.spyOn(toast, "success")
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ResetPasswordModal
        isOpen={true}
        onClose={vi.fn()}
        username="john_doe"
        temporaryPassword="TempPass123!"
      />
    )

    const copyBtn = screen.getByRole("button", { name: /Copiar clave|Copiar contraseña/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("TempPass123!")
      expect(toastSuccessSpy).toHaveBeenCalledWith("Contraseña temporal copiada al portapapeles")
      expect(screen.getByText(/¡Copiada!/i)).toBeDefined()
    })
  })

  it("shows manual copy instruction toast and does not show '¡Copiada!' when clipboard write fails", async () => {
    const toastErrorSpy = vi.spyOn(toast, "error")
    const writeTextMock = vi.fn().mockRejectedValue(new Error("Clipboard permission denied"))
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ResetPasswordModal
        isOpen={true}
        onClose={vi.fn()}
        username="john_doe"
        temporaryPassword="TempPass123!"
      />
    )

    const copyBtn = screen.getByRole("button", { name: /Copiar clave|Copiar contraseña/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("TempPass123!")
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No se pudo copiar automáticamente")
      )
    })

    // Must NOT show ¡Copiada!
    expect(screen.queryByText(/¡Copiada!/i)).toBeNull()
  })

  it("does not call onClose on Escape keydown, only on explicit button click", () => {
    const onCloseMock = vi.fn()
    render(
      <ResetPasswordModal
        isOpen={true}
        onClose={onCloseMock}
        username="john_doe"
        temporaryPassword="TempPass123!"
      />
    )

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" })
    expect(onCloseMock).not.toHaveBeenCalled()

    // Click explicit close button
    const closeBtn = screen.getByRole("button", { name: /Ya la copié|Cerrar/i })
    fireEvent.click(closeBtn)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
