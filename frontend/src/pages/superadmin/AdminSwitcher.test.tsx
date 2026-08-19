import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useOutletContext } from "react-router"
import AdminSwitcher from "./AdminSwitcher"
import AdminShell from "../admin/AdminShell"
import { AdminProvider } from "@/store/AdminContext"
import { SUPER_ADMIN_GRANT_KEY, adminGrantKey } from "@/store/admin-context"
import { storage } from "@/lib/storage"
import type { RestaurantRepository } from "@/lib/repository"

// Controlled mobile flag so the integration (shell) tests exercise the desktop
// sidebar deterministically (design AS-2).
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

/** Opens the switcher menu via its stable trigger label. */
function openSwitcher() {
  fireEvent.click(screen.getByRole("button", { name: /cambiar restaurante/i }))
}

describe("AdminSwitcher (presentational, AS-3)", () => {
  it("lists the directory restaurants plus a global option and reports the selection", () => {
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <AdminSwitcher directory={storage} value={undefined} onSelect={onSelect} />
      </MemoryRouter>
    )

    openSwitcher()
    expect(screen.getByRole("menuitem", { name: "Resumen global" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "BURGER PAGE" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "PIZZA ROMA" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "SUSHI TOKIO" })).toBeTruthy()

    fireEvent.click(screen.getByRole("menuitem", { name: "PIZZA ROMA" }))
    expect(onSelect).toHaveBeenCalledWith("rest-pizza-roma")
  })

  it("reports global (undefined) when the global option is chosen", () => {
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <AdminSwitcher directory={storage} value="rest-pizza-roma" onSelect={onSelect} />
      </MemoryRouter>
    )

    openSwitcher()
    fireEvent.click(screen.getByRole("menuitem", { name: "Resumen global" }))
    expect(onSelect).toHaveBeenCalledWith(undefined)
  })

  it("does not crash for an unknown/deleted current value", () => {
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <AdminSwitcher directory={storage} value="rest-deleted" onSelect={onSelect} />
      </MemoryRouter>
    )

    // The trigger degrades to the global label without throwing.
    expect(screen.getByText("Resumen global")).toBeTruthy()
    openSwitcher()
    expect(screen.getByRole("menuitem", { name: "BURGER PAGE" })).toBeTruthy()
  })

  it("never writes or reuses an admin grant key when selecting a restaurant", () => {
    const onSelect = vi.fn()
    // Simulate a stale grant from another tab (AD-1/AS-3 isolation).
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    render(
      <MemoryRouter>
        <AdminSwitcher directory={storage} value={undefined} onSelect={onSelect} />
      </MemoryRouter>
    )

    openSwitcher()
    fireEvent.click(screen.getByRole("menuitem", { name: "PIZZA ROMA" }))
    expect(onSelect).toHaveBeenCalledWith("rest-pizza-roma")

    // Selecting through the switcher must not create, reuse or elevate grants:
    // the stale key is left untouched and no new grant key appears.
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBe("1")
    expect(sessionStorage.getItem(adminGrantKey("rest-sushi-tokio"))).toBeNull()
  })
})

describe("AdminShell + AdminSwitcher integration (AD-1, AS-3)", () => {
  /** A scoped section slot: renders the not-found state when no repo is in scope. */
  function ScopedSlot() {
    const repo = useOutletContext<RestaurantRepository | undefined>()
    return repo ? <div>SCOPED-REPO-PRESENT</div> : <div>Página no encontrada</div>
  }

  function renderSuperShell(initialEntry = "/admin") {
    return render(
      <AdminProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<div>INDEX-SLOT</div>} />
              <Route path="products" element={<ScopedSlot />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AdminProvider>
    )
  }

  it("re-applies the selected restaurant palette and creates no restaurant grant", async () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    renderSuperShell()

    openSwitcher()
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "PIZZA ROMA" }))
    })

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue("--accent")
      ).toBe("rgb(230, 57, 70)")
    )
    // No restaurant-mode grant is created by the in-panel selection.
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
  })

  it("renders a not-found state (no crash) when a scoped restaurant is unavailable", async () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    // A deleted/unknown restaurant leaves no scoped repository, so the section
    // must render the not-found state instead of crashing (AS-3 Unknown).
    renderSuperShell("/admin/products")

    expect(await screen.findByText("Página no encontrada")).toBeTruthy()
  })
})
