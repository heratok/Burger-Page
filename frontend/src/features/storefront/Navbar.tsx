import { ShoppingCart } from "lucide-react"
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency, formatWhatsAppPhone } from "@/lib/utils"

interface NavbarProps {
  cantidad: number
  total: number
  onOpenCart: () => void
}

export default function Navbar({ cantidad, total, onOpenCart }: NavbarProps) {
  const { storeConfig } = useRestaurant()

  const cartLabel = `Ver orden, ${cantidad} ${cantidad === 1 ? "producto" : "productos"}, total ${formatCurrency(total)}`

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg-base/85 backdrop-blur-md transition-colors">
      {/* Optional Top Promotional Announcement Bar */}
      {storeConfig.showAnnouncement && storeConfig.announcementText && (
        <div
          style={{ backgroundColor: storeConfig.primaryColor }}
          className="px-4 py-1.5 text-center text-xs font-bold text-white tracking-wide shadow-xs"
        >
          {storeConfig.announcementText}
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-(--container) items-center justify-between px-4 md:px-6 lg:px-8">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 rounded-md px-4 py-2 font-medium text-white focus:outline-none focus:ring-2"
          style={{ backgroundColor: storeConfig.primaryColor }}
        >
          Saltar al contenido
        </a>

        {/* Logo & Brand Name */}
        <div className="flex items-center gap-3">
          {storeConfig.logoUrl ? (
            <img
              src={storeConfig.logoUrl}
              alt=""
              aria-hidden="true"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                borderColor: storeConfig.primaryColor,
              }}
              className="size-10 rounded-full object-cover border"
            />
          ) : (
            <div
              style={{ backgroundColor: storeConfig.primaryColor }}
              className="flex size-10 items-center justify-center rounded-full text-white font-bold text-base shadow-xs"
            >
              {storeConfig.name.charAt(0)}
            </div>
          )}

          <div className="flex flex-col leading-tight">
            <span
              style={{ color: "var(--color-text-primary)" }}
              className="text-base font-black tracking-tight"
            >
              {storeConfig.name}
            </span>
            <span
              style={{ color: "var(--color-text-muted)" }}
              className="text-xs line-clamp-1 font-medium"
            >
              {storeConfig.tagline}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Cart Icon */}
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={cartLabel}
            style={{
              borderColor: "var(--color-border-strong)",
              color: "var(--color-text-secondary)",
            }}
            className="relative inline-flex size-10 items-center justify-center rounded-full border transition duration-150 ease-out focus:outline-none focus-visible:focus-ring cursor-pointer hover:opacity-80"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {cantidad > 0 && (
              <span
                aria-hidden="true"
                style={{ backgroundColor: storeConfig.primaryColor }}
                className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs leading-none font-bold text-white shadow-xs"
              >
                {cantidad}
              </span>
            )}
          </button>

          {/* WhatsApp Direct Link */}
          {storeConfig.whatsappNumber && (
            <a
              href={`https://wa.me/${formatWhatsAppPhone(storeConfig.whatsappNumber)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Contactar por WhatsApp"
              style={{
                borderColor: "var(--color-border-strong)",
                color: "var(--color-text-secondary)",
              }}
              className="inline-flex size-10 items-center justify-center rounded-full border transition duration-150 ease-out hover:text-emerald-500 focus:outline-none focus-visible:focus-ring"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M20.52 3.48A11.88 11.88 0 0 0 12.06 0C5.5 0 .12 5.37.12 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.27-1.64a11.92 11.92 0 0 0 5.79 1.48h.01c6.56 0 11.94-5.37 11.94-11.94 0-3.19-1.24-6.19-3.49-8.42ZM12.07 21.8h-.01a9.84 9.84 0 0 1-5.02-1.38l-.36-.21-3.72.97 1-3.63-.24-.37a9.83 9.83 0 0 1-1.51-5.24c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.45-4.45 9.84-9.94 9.84Zm5.43-7.36c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.57-.49-.5-.66-.51l-.56-.01a1.08 1.08 0 0 0-.78.37c-.27.3-1.03 1-1.03 2.45 0 1.45 1.05 2.85 1.2 3.05.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.11.56-.08 1.76-.72 2-1.41.25-.69.25-1.28.18-1.4-.07-.13-.27-.2-.57-.35Z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
