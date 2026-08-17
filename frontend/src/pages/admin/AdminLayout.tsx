import { NavLink, Outlet } from "react-router"
import { LayoutDashboard } from "lucide-react"

/** Admin shell: header + section nav + routed content (design: AdminLayout). */
export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-elevated">
        <div className="mx-auto flex max-w-(--container) flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <LayoutDashboard className="size-4 text-primary" aria-hidden="true" />
            Panel de administración
          </p>
          <nav aria-label="Secciones de administración">
            <NavLink
              to="/admin/products"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
                }`
              }
            >
              Productos
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-(--container) px-4 py-6 md:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
