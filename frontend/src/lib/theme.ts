export interface RgbColor {
  r: number
  g: number
  b: number
}

/** Parses a #RRGGBB hex string; throws on any other input. */
export function hexToRgb(hex: string): RgbColor {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) throw new Error(`Invalid accent color: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  }
}

function rgbString({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`
}

function mixChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount)
}

/**
 * Applies the accent color to the four runtime CSS variables on `:root`.
 * - `--color-accent`: the raw color
 * - `--color-accent-hover`: blended 15% toward white
 * - `--color-accent-pressed`: blended 12% toward black
 * - `--color-accent-soft`: the accent RGB at 12% alpha (contrast preserved)
 *
 * The variables are consumed by index.css (`:root` defaults) and by the
 * Tailwind theme tokens (`--color-accent: var(--accent)` indirection).
 */
export function applyAccent(hex: string): void {
  const accent = hexToRgb(hex)
  const hover: RgbColor = {
    r: mixChannel(accent.r, 255, 0.15),
    g: mixChannel(accent.g, 255, 0.15),
    b: mixChannel(accent.b, 255, 0.15),
  }
  const pressed: RgbColor = {
    r: mixChannel(accent.r, 0, 0.12),
    g: mixChannel(accent.g, 0, 0.12),
    b: mixChannel(accent.b, 0, 0.12),
  }
  const root = document.documentElement
  root.style.setProperty("--color-accent", rgbString(accent))
  root.style.setProperty("--color-accent-hover", rgbString(hover))
  root.style.setProperty("--color-accent-pressed", rgbString(pressed))
  root.style.setProperty(
    "--color-accent-soft",
    `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.12)`
  )
}