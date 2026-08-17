import { NavLink, Outlet, useNavigate } from "react-router"
import { LayoutDashboard, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/store/admin-context"

const SECTIONS = [
  { to: "/admin/products", label: "Productos" },
  { to: "/admin/orders", label: "Pedidos" },
  { to: "/admin/sales", label: "Ventas" },
  { to: "/admin/config", label: "Configuración" },
]

/** Admin shell: header + section nav + routed content (design: AdminLayout). */
export default function AdminLayout() {
  const { logout } = useAdmin()
  const navigate = useNavigate()

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
            Panel de administración
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <nav aria-label="Secciones de administración">
              {SECTIONS.map(({ to, label }) => (
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
