import { Plus, ShoppingCart } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { Burger } from "@/data/data"

interface CardBurgerProps {
  hamburger: Burger
  onCliked: () => void
}

export default function CardBurger({ hamburger, onCliked }: CardBurgerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onCliked()
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onCliked}
      onKeyDown={handleKeyDown}
      aria-label={`Agregar ${hamburger.name} al carrito, $${hamburger.price.toLocaleString()}`}
      className="group cursor-pointer gap-0 rounded-lg border-border-subtle bg-bg-elevated py-0 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:focus-ring active:translate-y-0 active:shadow-sm"
    >
      <div className="aspect-video overflow-hidden bg-bg-elevated-2">
        <img
          src={hamburger.src}
          alt={hamburger.name}
          loading="lazy"
          className="size-full object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
        />
      </div>

      <CardContent className="flex flex-1 flex-col gap-2 px-4 pt-4">
        <h2 className="text-lg leading-tight font-semibold tracking-tight text-text-primary">
          {hamburger.name}
        </h2>
        <p className="line-clamp-2 text-sm leading-snug text-text-secondary">
          {hamburger.description}
        </p>
      </CardContent>

      <CardFooter className="mt-auto justify-between border-t-0 bg-transparent pt-3">
        <span className="text-lg font-bold text-accent">
          ${hamburger.price.toLocaleString()}
        </span>
        <span
          aria-hidden="true"
          data-icon="inline-end"
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-text-primary shadow-sm transition duration-150 ease-out group-hover:bg-accent-hover group-active:scale-95"
        >
          <ShoppingCart className="size-5" />
          <span className="absolute right-0.5 bottom-0.5 inline-flex size-4.5 items-center justify-center rounded-full bg-bg-elevated">
            <Plus className="size-3 text-accent" strokeWidth={3.5} />
          </span>
        </span>
      </CardFooter>
    </Card>
  )
}