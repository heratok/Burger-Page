import { Link } from "react-router"
import { UtensilsCrossed } from "lucide-react"
import { storage } from "../lib/storage"
import type { DirectoryRepository } from "../lib/repository"
import type { Restaurant } from "../lib/domain"

interface RestaurantDirectoryProps {
  directory?: DirectoryRepository
}

/**
 * Public directory (design D4, spec RD-1): lists every restaurant as a card
 * linking to its storefront. Cards expose no admin entry; the super-admin
 * portal is reachable only through a discreet footer link.
 */
export default function RestaurantDirectory({
  directory = storage,
}: RestaurantDirectoryProps) {
  const restaurants = directory.listRestaurants()

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-elevated">
        <div className="mx-auto max-w-(--container) px-4 py-8 text-center md:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Elige tu restaurante
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Explora el menú de cada lugar y haz tu pedido.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-(--container) px-4 py-8 md:px-6 lg:px-8">
        {restaurants.length === 0 ? (
          <EmptyDirectory />
        ) : (
          <ul
            role="list"
            aria-label="Restaurantes disponibles"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-border-subtle py-4">
        <p className="mx-auto max-w-(--container) px-4 text-center">
          <Link
            to="/admin"
            className="text-xs text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
          >
            Administración
          </Link>
        </p>
      </footer>
    </div>
  )
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <li className="min-w-0">
      <Link
        to={`/r/${restaurant.slug}`}
        className="flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-elevated p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:focus-ring"
      >
        <img
          src={restaurant.config.logo}
          alt=""
          aria-hidden="true"
          className="size-14 shrink-0 rounded-full bg-bg-elevated-2 object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold tracking-tight text-text-primary">
            {restaurant.config.name}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-2 text-xs text-text-muted">
            <span
              data-accent="true"
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: restaurant.palette.accent }}
            />
            Ver menú
          </span>
        </span>
      </Link>
    </li>
  )
}

function EmptyDirectory() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="mb-4 inline-flex size-20 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-text-muted">
        <UtensilsCrossed className="size-10" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-text-primary">
        Aún no hay restaurantes
      </h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        Cuando un restaurante se registre aparecerá aquí para que puedas ver su
        menú y hacer pedidos.
      </p>
    </div>
  )
}