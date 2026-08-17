import { NavLink, Outlet, useNavigate, useParams } from "react-router"
import { LayoutDashboard, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { storage } from "@/lib/storage"
import type { RestaurantRepository } from "@/lib/repository"
import { useAdmin } from "@/store/admin-context"

/**
 * Admin shell (design D4, spec AD-1): under /r/:slug/admin the section links
 * are prefixed with the route base and the header shows the restaurant name;
 * under the legacy /admin route it keeps the first-restaurant scope. The
 * scoped repository flows to the section pages through the Outlet context.
 */
export default function AdminLayout({ repo }: { repo?: RestaurantRepository }) {
  const { slug } = useParams()
  const { logout } = useAdmin()
  const navigate = useNavigate()
  const scoped = repo ?? storage
  const base = slug ? `/r/${slug}/admin` : "/admin"

  const sections = [
    { to: `${base}/products`, label: "Productos" },
    { to: `${base}/orders`, label: "Pedidos" },
    { to: `${base}/sales`, label: "Ventas" },
    { to: `${base}/config`, label: "Configuración" },
  ]

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-elevated">
        <div className="mx-auto flex max-w-(--container) flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <LayoutDashboard className="size-4 text-primary" aria-hidden="true" />
            {scoped.getConfig().name}
            <span className="text-xs font-medium text-text-secondary">
              Panel de administración
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