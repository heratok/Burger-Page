import { describe, expect, it } from "vitest"
import { getBgStyle, getStoreThemeStyles } from "./customizerStyles"

function luminance(hex: string): number {
  const n = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const THEMES = ["clean-white", "warm-cream", "deep-midnight", "dark-charcoal"] as const

describe("storefront theme text tokens meet WCAG AA (4.5:1)", () => {
  for (const theme of THEMES) {
    const vars = getStoreThemeStyles(theme) as Record<string, string>
    const surfaces = ["--color-bg-base", "--color-bg-surface", "--color-card"]
    for (const token of ["--color-text-muted", "--color-text-secondary", "--color-muted-foreground"]) {
      for (const surface of surfaces) {
        it(`${theme}: ${token} on ${surface}`, () => {
          expect(ratio(vars[token], vars[surface])).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
    it(`${theme}: preview subText on its background`, () => {
      const s = getBgStyle(theme)
      expect(ratio(s.subText, s.bg)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
