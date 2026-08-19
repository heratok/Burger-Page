import { Link } from "react-router"
import { Compass } from "lucide-react"

/**
 * Fallback for unknown slugs and unknown routes (spec RD-2 Unavailable,
 * ST-2 Fallback): explains the miss and links back to the directory.
 */
export default function NotFoundState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-muted">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-bold tracking-tight text-text-primary">
        Página no encontrada
      </h1>
      <p className="max-w-sm text-sm text-text-secondary">
        El restaurante o la página que buscas no existe o cambió de dirección.
      </p>
      <Link
        to="/"
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-primary transition duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:focus-ring"
      >
        Volver al directorio
      </Link>
    </div>
  )
}