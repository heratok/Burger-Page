/**
 * Pure color utilities for WCAG 1.4.3 contrast: merchants pick brand colors, we derive
 * readable text and fill variants from them (hue preserved) instead of trusting the raw value.
 */

export const LIGHT_TEXT = "#ffffff"
export const DARK_TEXT = "#0f172a"
export const MIN_TEXT_RATIO = 4.5

type Rgb = [number, number, number]

/** Normalizes #rgb / #rrggbb (with or without #) to lowercase #rrggbb, or null when invalid. */
export function normalizeHex(input?: string | null): string | null {
  if (!input) return null
  const clean = input.trim().replace(/^#/, "")
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) return null
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  return `#${full.toLowerCase()}`
}

function toRgb(hex: string): Rgb {
  const n = normalizeHex(hex) ?? "#000000"
  return [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16)) as Rgb
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = toRgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
  }
  return toHex([f(0), f(8), f(4)])
}

/**
 * Moves the HSL lightness of `hex` toward `target` (0 = black, 1 = white) by the smallest amount
 * for which `ok` holds. Hue and saturation are preserved. Returns null when even the extreme fails.
 */
function shiftLightness(hex: string, target: 0 | 1, ok: (candidate: string) => boolean): string | null {
  const { h, s, l } = hexToHsl(hex)
  const extreme = hslToHex(h, s, target)
  if (!ok(extreme)) return null
  let near = l // fails (or is the start)
  let far: number = target // passes
  for (let i = 0; i < 30; i++) {
    const mid = (near + far) / 2
    if (ok(hslToHex(h, s, mid))) far = mid
    else near = mid
  }
  return hslToHex(h, s, far)
}

/**
 * Returns a variant of `brand` readable as text on `bg` (one surface or several that must all pass):
 * darkened on light surfaces, lightened on dark ones, hue preserved. Untouched when it already passes.
 */
export function readableOn(bg: string | string[], brand: string, minRatio = MIN_TEXT_RATIO): string {
  const normalized = normalizeHex(brand)
  if (!normalized) return brand
  const surfaces = (Array.isArray(bg) ? bg : [bg]).map((s) => normalizeHex(s)).filter((s): s is string => !!s)
  if (surfaces.length === 0) return normalized
  const passes = (c: string) => surfaces.every((s) => contrastRatio(c, s) >= minRatio)
  if (passes(normalized)) return normalized

  // Prefer the direction that gives the surfaces more contrast headroom.
  const meanLum = surfaces.reduce((acc, s) => acc + relativeLuminance(s), 0) / surfaces.length
  const darkenFirst = (meanLum + 0.05) / 0.05 >= 1.05 / (meanLum + 0.05)
  const order: Array<0 | 1> = darkenFirst ? [0, 1] : [1, 0]
  for (const target of order) {
    const out = shiftLightness(normalized, target, passes)
    if (out) return out
  }
  // No tint reaches the ratio (conflicting surfaces): fall back to the best pure extreme.
  return surfaces.every((s) => contrastRatio("#000000", s) >= contrastRatio("#ffffff", s)) ? "#000000" : "#ffffff"
}

/** White or near-black text, whichever contrasts more with `fill`. */
export function onColor(fill: string): string {
  const n = normalizeHex(fill)
  if (!n) return LIGHT_TEXT
  return contrastRatio(DARK_TEXT, n) > contrastRatio(LIGHT_TEXT, n) ? DARK_TEXT : LIGHT_TEXT
}

/**
 * Fill + text pair. Keeps the fill when white or near-black text already reaches `minRatio`;
 * otherwise darkens the fill minimally (hue preserved) until white text passes.
 */
export function readableFill(fill: string, minRatio = MIN_TEXT_RATIO): { fill: string; text: string } {
  const n = normalizeHex(fill)
  if (!n) return { fill, text: LIGHT_TEXT }
  const text = onColor(n)
  if (contrastRatio(text, n) >= minRatio) return { fill: n, text }
  const darker = shiftLightness(n, 0, (c) => contrastRatio(LIGHT_TEXT, c) >= minRatio)
  return { fill: darker ?? "#000000", text: LIGHT_TEXT }
}
