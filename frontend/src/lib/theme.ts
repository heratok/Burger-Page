import type { RestaurantPalette } from "./domain"
import { DEFAULT_PALETTE } from "../data/data"

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

function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount)
}

function mixRgb(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  return {
    r: mixChannel(from.r, to.r, amount),
    g: mixChannel(from.g, to.g, amount),
    b: mixChannel(from.b, to.b, amount),
  }
}

/** WCAG 2.x relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two hex colors (1..21, order independent). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

// Derivation constants (design D3): deterministic, palette-independent.
const LIGHT_TEXT = "#F5F5F7"
const DARK_TEXT = "#0F1112"
const FOREGROUND_LUMINANCE_THRESHOLD = 0.4
const CONTRAST_AA_MIN = 4.5
const BLEND_STEP = 0.05
const ACCENT_HOVER_AMOUNT = 0.15
const ACCENT_PRESSED_AMOUNT = 0.12
const ACCENT_SOFT_ALPHA = 0.12
const TEXT_SECONDARY_BLEND = 0.2
const TEXT_MUTED_BLEND = 0.45
const SURFACE_STEPS = {
  elevated: 0.08,
  elevated2: 0.13,
  input: 0.05,
  borderSubtle: 0.14,
  borderStrong: 0.2,
} as const

/** Foreground for a colored surface: dark text when luminance >= 0.4 else light (design D3). */
function foregroundFor(color: string): RgbColor {
  return relativeLuminance(color) >= FOREGROUND_LUMINANCE_THRESHOLD
    ? hexToRgb(DARK_TEXT)
    : hexToRgb(LIGHT_TEXT)
}

/**
 * Body text for a background: the light/dark extreme with the higher contrast.
 * Matches the luminance rule for every normal palette and keeps TH-2's
 * "any palette" guarantee for mid-gray backgrounds.
 */
function textPrimaryFor(background: string): RgbColor {
  return contrastRatio(LIGHT_TEXT, background) >= contrastRatio(DARK_TEXT, background)
    ? hexToRgb(LIGHT_TEXT)
    : hexToRgb(DARK_TEXT)
}

/**
 * Blend of `from` toward `to` at the largest ratio <= startRatio whose contrast
 * against `base` stays >= 4.5:1, stepping down by BLEND_STEP (TH-2 fallback).
 * Deterministic: same inputs always produce the same output.
 */
function steppedBlend(base: string, from: string, to: string, startRatio: number): RgbColor {
  let ratio = startRatio
  while (ratio > 0) {
    const candidate = mixRgb(hexToRgb(from), hexToRgb(to), ratio)
    if (contrastRatio(rgbToHex(candidate), base) >= CONTRAST_AA_MIN) return candidate
    ratio -= BLEND_STEP
  }
  return hexToRgb(from)
}

/**
 * Derives the full runtime palette from the four explicit tokens and writes it
 * as CSS variables on `:root` (TH-1). Each var is written under its raw name
 * (`--accent`, `--bg-base`, ...) consumed by the Tailwind utilities through the
 * `@theme inline` indirection, plus its `--color-*` twin consumed directly by
 * custom CSS and the legacy applyAccent contract.
 *
 * destructive/success/warning are NOT written here — they stay fixed in CSS.
 */
export function applyTheme(palette: RestaurantPalette): void {
  const root = document.documentElement
  const background = palette.background
  const lightBackground = relativeLuminance(background) >= FOREGROUND_LUMINANCE_THRESHOLD
  const stepTarget = hexToRgb(lightBackground ? "#000000" : "#FFFFFF")

  const accent = hexToRgb(palette.accent)
  const primary = hexToRgb(palette.primary)
  const accentHover = mixRgb(accent, { r: 255, g: 255, b: 255 }, ACCENT_HOVER_AMOUNT)
  const accentPressed = mixRgb(accent, { r: 0, g: 0, b: 0 }, ACCENT_PRESSED_AMOUNT)

  const bgBase = hexToRgb(background)
  const bgSurface = hexToRgb(palette.surface)
  const bgElevated = mixRgb(bgBase, stepTarget, SURFACE_STEPS.elevated)
  const bgElevated2 = mixRgb(bgBase, stepTarget, SURFACE_STEPS.elevated2)
  const bgInput = mixRgb(bgBase, stepTarget, SURFACE_STEPS.input)
  const borderSubtle = mixRgb(bgBase, stepTarget, SURFACE_STEPS.borderSubtle)
  const borderStrong = mixRgb(bgBase, stepTarget, SURFACE_STEPS.borderStrong)

  const textPrimary = textPrimaryFor(background)
  const textPrimaryHex = rgbToHex(textPrimary)
  const textSecondary = steppedBlend(background, textPrimaryHex, background, TEXT_SECONDARY_BLEND)
  const textMuted = steppedBlend(background, textPrimaryHex, background, TEXT_MUTED_BLEND)

  const accentForeground = foregroundFor(palette.accent)
  const primaryForeground = foregroundFor(palette.primary)

  const values: Record<string, string> = {
    "--accent": rgbString(accent),
    "--accent-hover": rgbString(accentHover),
    "--accent-pressed": rgbString(accentPressed),
    "--accent-soft": `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${ACCENT_SOFT_ALPHA})`,
    "--accent-foreground": rgbString(accentForeground),
    "--primary-foreground": rgbString(primaryForeground),
    "--bg-base": rgbString(bgBase),
    "--bg-surface": rgbString(bgSurface),
    "--bg-elevated": rgbString(bgElevated),
    "--bg-elevated-2": rgbString(bgElevated2),
    "--bg-input": rgbString(bgInput),
    "--border-subtle": rgbString(borderSubtle),
    "--border-strong": rgbString(borderStrong),
    "--text-primary": rgbString(textPrimary),
    "--text-secondary": rgbString(textSecondary),
    "--text-muted": rgbString(textMuted),
    "--primary": rgbString(primary),
  }
  for (const [name, value] of Object.entries(values)) {
    root.style.setProperty(name, value)
    root.style.setProperty(`--color-${name.slice(2)}`, value)
  }
}

/**
 * Legacy single-accent entry point: applies the full default palette with the
 * given accent (and primary following it). Kept so existing consumers and
 * tests keep working while the app migrates to per-restaurant palettes.
 */
export function applyAccent(hex: string): void {
  applyTheme({ ...DEFAULT_PALETTE, accent: hex, primary: hex })
}