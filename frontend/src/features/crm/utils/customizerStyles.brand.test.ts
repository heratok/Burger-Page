import { describe, expect, it } from "vitest"
import { contrastRatio } from "@/lib/color"
import { getBrandTokens, getStoreThemeStyles } from "./customizerStyles"

const THEMES = ["clean-white", "warm-cream", "deep-midnight", "dark-charcoal"] as const
const BRANDS = ["#e63946", "#ff7a21", "#ffeb3b", "#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#111111", "#fafafa"]

describe("merchant brand colors derive readable text and fill tokens", () => {
  for (const theme of THEMES) {
    for (const brand of BRANDS) {
      const vars = getStoreThemeStyles(theme, brand) as Record<string, string>
      it(`${theme} ${brand}: brand text reaches 4.5:1 on every surface`, () => {
        for (const surface of ["--color-bg-base", "--color-bg-surface", "--color-card"]) {
          expect(contrastRatio(vars["--brand-text"], vars[surface])).toBeGreaterThanOrEqual(4.5)
        }
      })
      it(`${theme} ${brand}: on-brand text reaches 4.5:1 on the brand fill`, () => {
        expect(contrastRatio(vars["--on-brand"], vars["--brand-fill"])).toBeGreaterThanOrEqual(4.5)
        expect(vars["--color-primary"]).toBe(vars["--brand-fill"])
        expect(vars["--color-primary-foreground"]).toBe(vars["--on-brand"])
      })
    }
  }

  it("keeps the raw merchant color available for decorative uses", () => {
    const vars = getStoreThemeStyles("clean-white", "#E63946") as Record<string, string>
    expect(vars["--brand"].toLowerCase()).toBe("#e63946")
    expect(vars["--color-accent"]).toBe("#E63946")
  })

  it("getBrandTokens exposes the same derived values", () => {
    const t = getBrandTokens("#ff7a21", "clean-white")
    expect(contrastRatio(t.text, "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(t.onFill, t.fill)).toBeGreaterThanOrEqual(4.5)
  })

  it("open/closed status text is readable on every storefront theme", () => {
    for (const theme of THEMES) {
      const vars = getStoreThemeStyles(theme, "#e63946") as Record<string, string>
      for (const token of ["--status-open-text", "--status-closed-text"]) {
        expect(contrastRatio(vars[token], vars["--color-bg-base"]), theme + token).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(vars[token], vars["--color-bg-surface"]), theme + token).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
