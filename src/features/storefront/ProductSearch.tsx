import { useState } from "react"
import { Search, X } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { LIMITS } from "@/lib/validation"

export interface ProductSearchProps {
  onChangeText: (text: string) => void
  total?: number
}

export default function ProductSearch({ onChangeText, total = 0 }: ProductSearchProps) {
  const [value, setValue] = useState("")

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setValue(text)
    onChangeText(text)
  }

  const handleClear = () => {
    setValue("")
    onChangeText("")
  }

  const message =
    value.trim().length === 0
      ? total === 0
        ? "Sin resultados"
        : null
      : `${total} resultado${total === 1 ? "" : "s"}`

  return (
    <div className="w-full max-w-2xl">
      <label htmlFor="burger-search" className="sr-only">
        Buscar platos en la carta
      </label>
      <InputGroup className="h-11 rounded-full border-border-subtle bg-bg-input px-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent">
        <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-5">
          <Search className="text-text-muted" />
        </InputGroupAddon>
        <InputGroupInput
          id="burger-search"
          type="search"
          value={value}
          onChange={handleInputChange}
          placeholder="Buscar en el menú..."
          autoComplete="off"
          maxLength={LIMITS.busqueda.max}
          className="h-11 bg-transparent text-sm placeholder:text-text-muted text-text-primary focus:outline-none"
        />
        {value && (
          <InputGroupAddon align="inline-end" className="pr-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              className="size-10 rounded-full text-text-muted hover:bg-bg-elevated-2 hover:text-text-primary"
            >
              <X />
            </Button>
          </InputGroupAddon>
        )}
      </InputGroup>
      {message && (
        <p className="mt-2 text-center text-xs text-text-muted" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}
