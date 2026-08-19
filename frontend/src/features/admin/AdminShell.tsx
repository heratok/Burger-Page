import { useEffect, useMemo, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/shared/ui/ui/button"
import { Avatar, AvatarFallback } from "@/shared/ui/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/ui/sidebar"
import { storage } from "@/shared/storage/storage"
import type { LocalStorageRepository } from "@/shared/storage/storage"
import type { RestaurantRepository } from "@/shared/storage/repository"
import { useAdmin } from "@/store/admin-context"
import { applyTheme } from "@/shared/domain/theme"
import { DEFAULT_PALETTE } from "@/data/data"
import AdminSwitcher from "@/features/superadmin/AdminSwitcher"

interface AdminShellProps {
  directory?: LocalStorageRepository
}

interface Section {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

/**
 * Unified role-aware admin shell (design D1/D4, spec AS-1/AS-2, AD-1): replaces
 * the top pill header with a collapsible shadcn Sidebar (mobile Sheet drawer).
 * Nav sections are role-aware — restaurant sees Resumen/Productos/Pedidos
 * (pending badge)/Configuración; super sees Resumen global/Restaurantes/
 * Contraseña, plus a restaurant switcher in the header. A super selection is
 * VIEW state (dies on reload), never a session grant: the switcher re-scopes
 * the Outlet repository and re-applies the restaurant palette, and it never
 * writes `admin-granted:{id}` keys (AD-1/AS-3 isolation).
 */
export default function AdminShell({ directory = storage }: AdminShellProps) {
  const { session, logout } = useAdmin()
  const navigate = useNavigate()

  // Super restaurant selection (design D1): VIEW state, undefined = global
  // summary. Lives in the shell so it survives in-panel nav but dies on reload;
  // it is NOT a session grant and never creates a restaurant grant key.
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | undefined>(undefined)

  const restaurants = directory.listRestaurants()
  const isSuper = session?.mode === "super"
  const sessionRestaurant =
    session?.mode === "restaurant"
      ? restaurants.find((r) => r.id === session.restaurantId)
      : undefined

  // The restaurant whose sections are in scope: the switcher selection for
  // super, or the session's own restaurant. Missing/deleted => undefined, so a
  // stale selection degrades to the not-found state instead of leaking data.
  const selectedRestaurant = isSuper
    ? activeRestaurantId !== undefined
      ? restaurants.find((r) => r.id === activeRestaurantId)
      : undefined
    : sessionRestaurant

  // Outlet context repo (design D1): super -> selected restaurant (or none for
  // the global summary); restaurant -> its own tenant. Never a grant key.
  const scoped: RestaurantRepository | undefined = selectedRestaurant
    ? directory.getRepositoryFor(selectedRestaurant.id)
    : undefined

  const pendingCount = scoped
    ? (scoped.listOrders() ?? []).filter((o) => o.status === "new" || o.status === "confirmed").length
    : 0

  // In-panel theme (design D1, AD-1): the active restaurant's palette, or the
  // default for the global summary. Re-derived when the selection changes.
  const selectedPalette = useMemo(() => {
    return selectedRestaurant ? selectedRestaurant.palette : DEFAULT_PALETTE
  }, [selectedRestaurant])

  useEffect(() => {
    applyTheme(selectedPalette)
  }, [selectedPalette])

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const restaurantSections: Section[] = [
    { to: "/admin", label: "Resumen", icon: LayoutDashboard },
    { to: "/admin/products", label: "Productos", icon: Package },
    { to: "/admin/orders", label: "Pedidos", icon: ShoppingBag, badge: pendingCount },
    { to: "/admin/config", label: "Configuración", icon: Settings },
  ]

  const superGlobalSections: Section[] = [
    { to: "/admin", label: "Resumen global", icon: LayoutDashboard },
    { to: "/admin/restaurants", label: "Restaurantes", icon: Building2 },
    { to: "/admin/password", label: "Contraseña", icon: KeyRound },
  ]

  const sections = isSuper
    ? selectedRestaurant
      ? restaurantSections
      : superGlobalSections
    : sessionRestaurant
      ? restaurantSections
      : []

  const footerLabel = isSuper ? "Super administrador" : sessionRestaurant?.config.name
  const footerSubtitle = isSuper ? "Portal de administración" : "Restaurante"

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {isSuper && (
            <AdminSwitcher
              directory={directory}
              value={activeRestaurantId}
              onSelect={setActiveRestaurantId}
            />
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Secciones</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((section) => (
                  <SidebarMenuItem key={section.to}>
                    <SidebarNavLink {...section} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <div className="flex items-center gap-2 p-1">
            <Avatar size="sm">
              <AvatarFallback>{(footerLabel ?? "A").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {footerLabel}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {footerSubtitle}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet context={scoped} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Nav link rendered through the sidebar menu button; closes the mobile drawer on select (AS-2). */
function SidebarNavLink({ to, label, icon: Icon, badge }: Section) {
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const isActive =
    to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to)
  return (
    <SidebarMenuButton
      render={<NavLink to={to} />}
      isActive={isActive}
      onClick={() => setOpenMobile(false)}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
    </SidebarMenuButton>
  )
}
