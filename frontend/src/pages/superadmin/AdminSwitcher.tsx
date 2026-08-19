import { Building2, Check, ChevronsUpDown, LayoutDashboard } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { storage } from "@/lib/storage"
import type { DirectoryRepository } from "@/lib/repository"

interface AdminSwitcherProps {
  directory?: DirectoryRepository
  /** Active restaurant id; `undefined` = global summary. VIEW state (D1). */
  value: string | undefined
  onSelect: (id: string | undefined) => void
}

/**
 * Super restaurant switcher (design D1, spec AS-3/AD-1): a dropdown in the
 * sidebar header that re-scopes the in-panel sections to the selected
 * restaurant or back to the global summary. It lists restaurants through
 * `DirectoryRepository.listRestaurants` and reports the selection upward; it
 * NEVER writes, reuses or elevates `admin-granted:{id}` keys — the selection is
 * pure VIEW state owned by the shell.
 */
export default function AdminSwitcher({
  directory = storage,
  value,
  onSelect,
}: AdminSwitcherProps) {
  const restaurants = directory.listRestaurants()
  const current = value !== undefined ? restaurants.find((r) => r.id === value) : undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Cambiar restaurante"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Building2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{current?.config.name ?? "Resumen global"}</span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--anchor-width) min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cambiar restaurante</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSelect(undefined)}>
            <LayoutDashboard aria-hidden="true" />
            Resumen global
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {restaurants.map((restaurant) => (
            <DropdownMenuItem key={restaurant.id} onClick={() => onSelect(restaurant.id)}>
              <span className="truncate">{restaurant.config.name}</span>
              {value === restaurant.id && <Check className="ml-auto" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
