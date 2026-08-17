import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { LocalStorageRepository, STORAGE_KEY } from "@/lib/storage"
import SuperPasswordPage from "./SuperPasswordPage"

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

function renderPage(directory: LocalStorageRepository) {
  return render(
    <MemoryRouter initialEntries={["/admin/password"]}>
      <SuperPasswordPage directory={directory} />
    </MemoryRouter>
  )
}

function readEnvelopeSuperPassword(): string {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").superAdminPassword
}

describe("SuperPasswordPage (SA-4)", () => {
  it("rejects a confirmation mismatch and keeps the old password (SA-4 Mismatch)", async () => {
    const directory = new LocalStorageRepository(window.localStorage)
    // First read persists the seeded envelope so the "old" password is verifiable.
    directory.listRestaurants()
    renderPage(directory)

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "nueva-secreta" },
    })
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "otra-secreta" },
    })
    fireEvent.click(screen.getByRole("button", { name: /actualizar contraseña/i }))

    expect(await screen.findByText(/no coinciden/i)).toBeTruthy()
    expect(readEnvelopeSuperPassword()).toBe("superadmin")
    expect(directory.getSuperAdminPassword()).toBe("superadmin")
  })

  it("updates the super password when the confirmation matches", async () => {
    const directory = new LocalStorageRepository(window.localStorage)
    directory.listRestaurants()
    renderPage(directory)

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "nueva-secreta" },
    })
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "nueva-secreta" },
    })
    fireEvent.click(screen.getByRole("button", { name: /actualizar contraseña/i }))

    await waitFor(() => expect(readEnvelopeSuperPassword()).toBe("nueva-secreta"))
    expect(directory.getSuperAdminPassword()).toBe("nueva-secreta")
  })
})