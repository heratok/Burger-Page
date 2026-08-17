import { NavLink, Outlet, useNavigate } from "react-router"
import { LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/store/admin-context"

/**
 * Super-admin portal shell (design D4, spec SA-1): header with the section
 * navigation (restaurants, password) and logout. Section pages flow through
 * the Outlet; the default palette is applied by the route wrapper.
 */
export default function SuperAdminLayout() {
  const { logout } = useAdmin()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const sections = [
    { to: "/admin/restaurants", label: "Restaurantes" },
    { to: "/admin/password", label: "Contraseña" },
  ]

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-elevated">
        <div className="mx-auto flex max-w-(--container) flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Portal de administración
            <span className="text-xs font-medium text-text-secondary">
              Super administrador
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <nav aria-label="Secciones del portal">
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
        <Outlet />
      </main>
    </div>
  )
}