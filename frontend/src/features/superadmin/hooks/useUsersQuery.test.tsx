import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { UsersDirectory } from "../UsersDirectory"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

const users = [
  { id: "usr-1", username: "cached_user", role: "restaurant_admin", isActive: true },
]

const renderDirectory = () =>
  render(
    <RestaurantProvider>
      <UsersDirectory />
    </RestaurantProvider>
  )

describe("UsersDirectory server state (users query)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("reuses the cached list on remount instead of fetching again", async () => {
    const listSpy = vi.spyOn(apiClient, "listUsers").mockResolvedValue(users as any)

    const first = renderDirectory()
    expect(await screen.findByText("cached_user")).toBeDefined()
    first.unmount()

    renderDirectory()
    // Served synchronously from the cache: no skeleton, no second request.
    expect(screen.getByText("cached_user")).toBeDefined()
    expect(listSpy).toHaveBeenCalledTimes(1)
  })

  it("refetches the list after a user write settles", async () => {
    const listSpy = vi
      .spyOn(apiClient, "listUsers")
      .mockResolvedValueOnce(users as any)
      .mockResolvedValue([{ ...users[0], isActive: false }] as any)
    vi.spyOn(apiClient, "setUserActive").mockResolvedValue({ ...users[0], isActive: false } as any)

    renderDirectory()
    await screen.findByText("cached_user")
    fireEvent.click(screen.getByRole("button", { name: /Desactivar/i }))

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Inactivo")).toBeDefined()
  })

  it("refetches the list after a user is deleted", async () => {
    const listSpy = vi
      .spyOn(apiClient, "listUsers")
      .mockResolvedValueOnce(users as any)
      .mockResolvedValue([])
    vi.spyOn(apiClient, "deleteUser").mockResolvedValue(undefined as any)

    renderDirectory()
    await screen.findByText("cached_user")
    fireEvent.click(screen.getByRole("button", { name: /Eliminar usuario/i }))
    fireEvent.click(await screen.findByRole("button", { name: /Eliminar definitivamente/i }))

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText("cached_user")).toBeNull())
  })

  it("shows the error toast and an inline retryable error (never the empty directory) when the list cannot be read", async () => {
    const toastError = vi.spyOn(toast, "error")
    const listSpy = vi.spyOn(apiClient, "listUsers").mockRejectedValue(new Error("boom-users"))

    renderDirectory()

    const alert = await screen.findByRole("alert")
    // One toast per failed read, and it is ours, not the server's raw string.
    expect(toastError).toHaveBeenCalledTimes(1)
    // The failure is a state with a way out of it.
    expect(alert.textContent).toMatch(/No se pudo cargar la lista de usuarios/i)
    expect(alert.textContent).not.toContain("boom-users")
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }))
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
    // A failed read is not an empty directory.
    expect(screen.queryByText(/No se encontraron usuarios coincidentes/i)).toBeNull()
    expect(screen.queryByText(/^boom-users$/)).toBeNull()
  })
})
