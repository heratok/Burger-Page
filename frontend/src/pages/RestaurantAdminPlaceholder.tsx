import { Link, useParams } from "react-router"
import { Construction } from "lucide-react"

/**
 * Placeholder shell for the per-restaurant admin console (design D4).
 * Landing here is safe for any slug; the mode-aware AdminGate and scoped
 * AdminLayout arrive in the P5 slice. No auth behavior lives here.
 */
export default function RestaurantAdminPlaceholder() {
  const { slug } = useParams()

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-muted">
        <Construction className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-bold tracking-tight text-text-primary">
        Panel de {slug}
      </h1>
      <p className="max-w-sm text-sm text-text-secondary">
        La administración de este restaurante estará disponible próximamente.
      </p>
      <Link
        to={`/r/${slug}`}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-primary transition duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:focus-ring"
      >
        Volver al restaurante
      </Link>
    </div>
  )
}