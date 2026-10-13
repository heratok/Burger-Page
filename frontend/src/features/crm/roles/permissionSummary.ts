import type { Permission } from "@burger-page/contracts"

export interface PermissionAreaSummary {
  /** Short Spanish area name, e.g. "Pedidos". */
  area: string
  /** Natural Spanish action list, e.g. "ver, gestionar y eliminar". */
  actions: string
  /** True when any action in this area is sensitive (money, team, roles, settings). */
  sensitive: boolean
}

type Action = "ver" | "gestionar" | "eliminar"

interface AreaDef {
  area: string
  permissions: Partial<Record<Permission, { action: Action; sensitive?: boolean }>>
}

// Order here is the order lines are shown on the role card.
const AREAS: AreaDef[] = [
  {
    area: "Pedidos",
    permissions: {
      "orders.view": { action: "ver" },
      "orders.manage": { action: "gestionar" },
      "orders.delete": { action: "eliminar" },
    },
  },
  {
    area: "Clientes",
    permissions: {
      "customers.view": { action: "ver" },
      "customers.manage": { action: "gestionar" },
    },
  },
  { area: "Menú", permissions: { "menu.manage": { action: "gestionar" } } },
  { area: "Inventario", permissions: { "inventory.manage": { action: "gestionar" } } },
  { area: "Mesas", permissions: { "tables.manage": { action: "gestionar" } } },
  { area: "Finanzas", permissions: { "finance.view": { action: "ver", sensitive: true } } },
  { area: "Equipo", permissions: { "users.manage": { action: "gestionar", sensitive: true } } },
  { area: "Roles", permissions: { "roles.manage": { action: "gestionar", sensitive: true } } },
  {
    area: "Configuración",
    permissions: { "settings.manage": { action: "gestionar", sensitive: true } },
  },
]

const ACTION_ORDER: Action[] = ["ver", "gestionar", "eliminar"]

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
}

/** Turns a permission list into one plain-language line per area. */
export function summarizePermissions(permissions: readonly Permission[]): PermissionAreaSummary[] {
  const granted = new Set(permissions)
  const lines: PermissionAreaSummary[] = []

  for (const def of AREAS) {
    const entries = (Object.entries(def.permissions) as [Permission, { action: Action; sensitive?: boolean }][])
      .filter(([perm]) => granted.has(perm))
    if (entries.length === 0) continue
    const actions = ACTION_ORDER.filter((a) => entries.some(([, meta]) => meta.action === a))
    lines.push({
      area: def.area,
      actions: joinNatural(actions),
      sensitive: entries.some(([, meta]) => meta.sensitive === true),
    })
  }

  return lines
}
