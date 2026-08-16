interface CharacterCounterProps {
  value: string
  max: number
}

/**
 * Contador de caracteres para textareas/inputs con límite.
 * Se oculta cuando el campo está vacío y resalta al llegar al máximo.
 */
export default function CharacterCounter({ value, max }: CharacterCounterProps) {
  const length = value.length
  if (length === 0) return null
  const atLimit = length >= max
  return (
    <p
      aria-live="polite"
      data-slot="character-counter"
      className={`mt-1 text-right text-xs ${
        atLimit ? "font-medium text-destructive" : "text-text-muted"
      }`}
    >
      {length}/{max}
    </p>
  )
}
