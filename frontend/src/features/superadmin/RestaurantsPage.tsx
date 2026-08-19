import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { CircleAlert, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/shared/ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/ui/dialog"
import { storage } from "@/shared/storage/storage"
import type { DirectoryRepository } from "@/shared/storage/repository"
import type { Restaurant } from "@/shared/domain/domain"
import { adminGrantKey } from "@/store/admin-context"

interface RestaurantsPageProps {
  directory?: DirectoryRepository
}

/**
 * Super portal restaurant management (design D4, spec SA-2/SA-3): lists every
 * restaurant with its slug, logo, accent and product count; links into each
 * restaurant's admin for quick access; deletes only through an explicit
 * confirmation dialog. Deleting the last restaurant is blocked, and a
 * confirmed delete invalidates that restaurant's admin session (SA-3).
 */
export default function RestaurantsPage({
  directory = storage,
}: RestaurantsPageProps) {
  const restaurants = directory.listRestaurants()
  const [deleting, setDeleting] = useState<Restaurant | null>(null)
  const [blocked, setBlocked] = useState(false)

  const confirmDelete = () => {
    if (!deleting) return
    if (!directory.deleteRestaurant(deleting.id)) {
      // Last restaurant: refused at the repository level (SA-3 Last).
      setBlocked(true)
      setDeleting(null)
      return
    }
    // Any active admin session for the removed restaurant must stop granting
    // access (SA-3); the scoped route already resolves to not-found, but the
    // stale grant key must not survive.
    sessionStorage.removeItem(adminGrantKey(deleting.id))
    toast.success("Restaurante eliminado")
    setDeleting(null)
  }

  return (
    <section aria-labelledby="restaurants-title">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            id="restaurants-title"
            className="text-2xl font-bold tracking-tight text-text-primary"
          >
            Restaurantes
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Gestiona los restaurantes de la plataforma y su acceso administrativo.
          </p>
        </div>
        <Link to="/admin/restaurants/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          Nuevo restaurante
        </Link>
      </header>

      {blocked && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          No se puede eliminar el último restaurante.
        </p>
      )}

      <ul
        role="list"
        aria-label="Restaurantes de la plataforma"
        className="flex flex-col gap-3"
      >
        {restaurants.map((restaurant) => (
          <li
            key={restaurant.id}
            className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-card p-4"
          >
            <img
              src={restaurant.config.logo}
              alt=""
              aria-hidden="true"
              className="size-12 shrink-0 rounded-full bg-bg-elevated-2 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <span className="truncate">{restaurant.config.name}</span>
                <span
                  data-accent="true"
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: restaurant.palette.accent }}
                />
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Slug: {restaurant.slug} · {restaurant.products.length} productos
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to="/admin"
                aria-label={`Administrar ${restaurant.config.name}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink />
                Administrar
              </Link>
              <Link
                to={`/admin/restaurants/${restaurant.id}/edit`}
                aria-label={`Editar ${restaurant.config.name}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil />
                Editar
              </Link>
              <Button
                variant="destructive"
                size="sm"
                aria-label={`Eliminar ${restaurant.config.name}`}
                onClick={() => {
                  setBlocked(false)
                  setDeleting(restaurant)
                }}
              >
                <Trash2 />
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <DeleteRestaurantDialog
        restaurant={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

interface DeleteRestaurantDialogProps {
  restaurant: Restaurant | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteRestaurantDialog({
  restaurant,
  onConfirm,
  onCancel,
}: DeleteRestaurantDialogProps) {
  return (
    <Dialog
      open={restaurant !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar restaurante</DialogTitle>
          <DialogDescription>
            Se eliminará «{restaurant?.config.name}» con todos sus productos,
            modificadores y pedidos. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}