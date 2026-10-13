import { describe, it, expect } from "vitest"
import { PERMISSIONS } from "@burger-page/contracts"
import { summarizePermissions, describeRoleAreas } from "./permissionSummary"

describe("summarizePermissions", () => {
  it("returns no lines for an empty permission list", () => {
    expect(summarizePermissions([])).toEqual([])
  })

  it("joins two actions with 'y'", () => {
    expect(summarizePermissions(["orders.view", "orders.manage"])).toEqual([
      { area: "Pedidos", actions: "ver y gestionar", sensitive: false },
    ])
  })

  it("joins three actions with commas and a final 'y'", () => {
    expect(summarizePermissions(["orders.delete", "orders.view", "orders.manage"])).toEqual([
      { area: "Pedidos", actions: "ver, gestionar y eliminar", sensitive: false },
    ])
  })

  it("keeps a stable area order regardless of input order", () => {
    const lines = summarizePermissions(["tables.manage", "customers.view", "orders.view"])
    expect(lines.map((l) => l.area)).toEqual(["Pedidos", "Clientes", "Mesas"])
    expect(lines[2]).toEqual({ area: "Mesas", actions: "gestionar", sensitive: false })
  })

  it("flags sensitive permissions", () => {
    const lines = summarizePermissions([
      "finance.view",
      "users.manage",
      "roles.manage",
      "settings.manage",
      "menu.manage",
    ])
    const byArea = Object.fromEntries(lines.map((l) => [l.area, l.sensitive]))
    expect(byArea).toEqual({
      Menú: false,
      Finanzas: true,
      Equipo: true,
      Roles: true,
      Configuración: true,
    })
  })

  it("ignores duplicates and covers every contract permission", () => {
    expect(summarizePermissions(["orders.view", "orders.view"])).toHaveLength(1)
    const all = summarizePermissions([...PERMISSIONS])
    expect(all.length).toBeGreaterThanOrEqual(9)
    expect(all.every((l) => l.actions.length > 0)).toBe(true)
  })
})

describe("describeRoleAreas", () => {
  it("lists the first areas of a role as a short comma separated hint", () => {
    expect(
      describeRoleAreas(["orders.view", "customers.view", "tables.manage", "menu.manage"], 3)
    ).toBe("Pedidos, Clientes, Menú y más")
  })

  it("does not add 'y más' when everything fits", () => {
    expect(describeRoleAreas(["orders.view", "tables.manage"], 3)).toBe("Pedidos, Mesas")
  })

  it("returns an empty string for a role without permissions", () => {
    expect(describeRoleAreas([], 3)).toBe("")
  })
})
