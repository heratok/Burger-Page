import { NavLink, Outlet, useNavigate } from "react-router"
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { storage } from "@/lib/storage"
import type { LocalStorageRepository } from "@/lib/storage"
import type { RestaurantRepository } from "@/lib/repository"
import { useAdmin } from "@/store/admin-context"

interface AdminLayoutProps {
  /** Concrete repository: the layout builds per-restaurant scoped views. */
  directory?: LocalStorageRepository
}

/**
 * Unified admin shell (design D4, spec AD-1/SA-1): ONE layout for both roles.
 * A super session sees the restaurant management sections (Restaurantes,
 * Contraseña) plus the restaurant admin sections scoped to the first
 * restaurant (legacy default); a restaurant session sees only its own
 * products/orders/sales/config sections scoped to its tenant. The scoped
 * repository flows to the section pages through the Outlet context.
 */
export default function AdminLayout({ directory = storage }: AdminLayoutProps) {
  const { session, logout } = useAdmin()
  const navigate = useNavigate()

  const restaurants = directory.listRestaurants()
  const isSuper = session?.mode === "super"
  const sessionRestaurant =
    session?.mode === "restaurant"
      ? restaurants.find((r) => r.id === session.restaurantId)
      : undefined

  // Super sections only for the platform owner; restaurant sections only for
  // restaurant sessions (and for super, scoped to the first restaurant).
  const scoped: RestaurantRepository | undefined = sessionRestaurant
    ? directory.getRepositoryFor(sessionRestaurant.id)
    : isSuper && restaurants.length > 0
      ? directory.getRepositoryFor(restaurants[0].id)
      : undefined

  const sections: { to: string; label: string }[] = []
  if (sessionRestaurant) {
    sections.push(
      { to: "/admin/products", label: "Productos" },
      { to: "/admin/orders", label: "Pedidos" },
      { to: "/admin/sales", label: "Ventas" },
      { to: "/admin/config", label: "Configuración" }
    )
  }
  if (isSuper) {
    sections.push(
      { to: "/admin/restaurants", label: "Restaurantes" },
      { to: "/admin/password", label: "Contraseña" }
    )
    if (scoped) {
      sections.push(
        { to: "/admin/products", label: "Productos" },
        { to: "/admin/orders", label: "Pedidos" },
        { to: "/admin/sales", label: "Ventas" },
        { to: "/admin/config", label: "Configuración" }
      )
    }
  }

  const headerTitle = isSuper
    ? "Portal de administración"
    : (sessionRestaurant?.config.name ?? "Panel de administración")
  const headerSubtitle = isSuper ? "Super administrador" : "Panel de administración"
  const HeaderIcon = isSuper ? ShieldCheck : LayoutDashboard

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-elevated">
        <div className="mx-auto flex max-w-(--container) flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <HeaderIcon className="size-4 text-primary" aria-hidden="true" />
            {headerTitle}
            <span className="text-xs font-medium text-text-secondary">
              {headerSubtitle}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <nav aria-label="Secciones de administración">
              {sections.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary hover:bg-muted hover:text-text-primary"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="ml-1"
            >
              <LogOut data-icon="inline-start" />
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-(--container) px-4 py-6 md:px-6 lg:px-8">
        <Outlet context={scoped} />
      </main>
    </div>
  )
}