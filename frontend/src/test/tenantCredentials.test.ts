import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { TenantProvider, useTenant } from "@/context/slices/TenantContext"
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

/**
 * SUS-20: the one-time tenant admin password must never be persisted at rest
 * in the localStorage platform envelope, and must never be re-merged into the
 * envelope from backend responses. Any XSS in the admin UI or any user of a
 * shared machine could otherwise read every tenant's admin credentials.
 */

/** Recursively reports whether any adminPassword key exists in a parsed value. */
function hasAdminPassword(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasAdminPassword)
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, child]) => key === "adminPassword" || hasAdminPassword(child)
    )
  }
  return false
}

function readPersistedEnvelope(): unknown {
  const raw = localStorage.getItem("burger_page_platform_v2")
  return raw ? JSON.parse(raw) : {}
}

describe("Tenant credentials never persist (SUS-20)", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("Seam A: persists an envelope without adminPassword while the toast surfaces the credentials once", async () => {
    vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-creds-1",
      slug: "creds-tenant",
      adminUsername: "admin_creds-tenant",
      adminPassword: "server-secret-abc",
    } as any)
    // Reject the refresh sync (like hermeticApi): a real backend would not
    // return the brand-new tenant on the mount sync.
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))
    const toastSpy = vi.spyOn(toast, "success")

    // .ts file (no JSX): build the provider tree with createElement.
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TenantProvider, null, children)
    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.createRestaurant({
        name: "Creds Tenant",
        slug: "creds-tenant",
        tagline: "Creds",
        whatsappNumber: "3000000000",
      })
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The persisted envelope (what a shared machine or XSS payload reads)
    // must not contain the one-time password anywhere.
    expect(hasAdminPassword(readPersistedEnvelope())).toBe(false)

    // The one-time credentials were still surfaced exactly once to the caller
    // (the generic success toast is separate and unconditional).
    const credentialToasts = toastSpy.mock.calls.filter(([, opts]) =>
      typeof (opts as any)?.description === "string" &&
      (opts as any).description.includes("Clave:")
    )
    expect(credentialToasts).toHaveLength(1)
    expect(toastSpy).toHaveBeenCalledWith(
      "Restaurante creado con éxito",
      expect.objectContaining({
        description: "Usuario: admin_creds-tenant — Clave: server-secret-abc",
      })
    )
  })

  it("Seam B: refreshRestaurants never re-merges adminPassword from backend responses into the envelope record", async () => {
    // Seed an empty local envelope: nothing carries a password on disk.
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants: [] })
    )
    // A hostile or regression-prone backend response may still include the
    // field; the client must never adopt it into the envelope.
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([
      {
        id: "rest-refresh-1",
        slug: "refresh-tenant",
        name: "Refresh Tenant",
        isActive: true,
        createdAt: "2026-08-01T12:00:00.000Z",
        config: { ...DEFAULT_STORE_CONFIG, name: "Refresh Tenant" },
        adminPassword: "leaked-secret-xyz",
      } as any,
    ])

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TenantProvider, null, children)
    const { result } = renderHook(() => useTenant(), { wrapper })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const record = result.current.restaurants.find((r) => r.slug === "refresh-tenant")
    expect(record).toBeDefined()
    expect((record as any).adminPassword).toBeUndefined()
    expect(hasAdminPassword(readPersistedEnvelope())).toBe(false)
  })

  it("TRIANGULATE: legacy envelopes that already stored a password are sanitized on the next save", async () => {
    // Real users created tenants before SUS-20: their disk envelope may still
    // hold the secret. The persistence boundary must migrate it away.
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [
          {
            id: "rest-legacy-1",
            slug: "legacy-tenant",
            adminPassword: "legacy-leaked-secret",
            isActive: true,
            createdAt: "2025-01-01T00:00:00.000Z",
            config: { ...DEFAULT_STORE_CONFIG },
            products: [],
            additions: [],
            orders: [],
            customers: [],
          },
        ],
      })
    )
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TenantProvider, null, children)
    renderHook(() => useTenant(), { wrapper })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The stored copy is cleaned at the boundary, even though the in-memory
    // record may still carry the legacy value until the next refresh.
    expect(hasAdminPassword(readPersistedEnvelope())).toBe(false)
  })

  it("TRIANGULATE: a user-provided adminPassword still reaches the backend but never the envelope", async () => {
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-prov-1",
      slug: "prov-tenant",
      adminUsername: "admin_prov",
      adminPassword: "user-chosen-pass",
    } as any)
    vi.spyOn(apiClient, "listRestaurants").mockRejectedValue(new Error("no backend in tests"))

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(TenantProvider, null, children)
    const { result } = renderHook(() => useTenant(), { wrapper })

    act(() => {
      result.current.createRestaurant({
        name: "Prov Tenant",
        slug: "prov-tenant",
        tagline: "P",
        whatsappNumber: "3000000003",
        adminUsername: "admin_prov",
        adminPassword: "user-chosen-pass",
      })
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Create input contract is preserved: the chosen password goes to the API.
    expect(createSpy.mock.calls[0][0].adminPassword).toBe("user-chosen-pass")
    const record = result.current.restaurants.find((r) => r.slug === "prov-tenant")
    expect(record).toBeDefined()
    expect((record as any).adminUsername).toBe("admin_prov")
    expect((record as any).adminPassword).toBeUndefined()
    expect(hasAdminPassword(readPersistedEnvelope())).toBe(false)
  })
})