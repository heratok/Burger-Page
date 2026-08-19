import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { DefaultThemeScope, ThemeScope } from "./ThemeScope"
import { DEFAULT_PALETTE } from "@/data/data"
import type { RestaurantPalette } from "@/shared/domain/domain"

const ROMA_PALETTE: RestaurantPalette = {
  accent: "#E63946",
  primary: "#E63946",
  background: "#0F1112",
  surface: "#181A1B",
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute("style")
})

describe("ThemeScope (TH-1, TH-2)", () => {
  it("applies the given palette to :root on mount", () => {
    render(
      <ThemeScope palette={ROMA_PALETTE}>
        <p>contenido</p>
      </ThemeScope>
    )

    expect(
      document.documentElement.style.getPropertyValue("--accent")
    ).toBe("rgb(230, 57, 70)")
    expect(
      document.documentElement.style.getPropertyValue("--bg-base")
    ).toBe("rgb(15, 17, 18)")
    expect(
      document.documentElement.style.getPropertyValue("--border-subtle")
    ).toBeTruthy()
  })

  it("reapplies the theme when the palette prop changes", () => {
    const { rerender } = render(
      <ThemeScope palette={ROMA_PALETTE}>
        <p>contenido</p>
      </ThemeScope>
    )

    rerender(
      <ThemeScope palette={DEFAULT_PALETTE}>
        <p>contenido</p>
      </ThemeScope>
    )

    expect(
      document.documentElement.style.getPropertyValue("--accent")
    ).toBe("rgb(255, 122, 33)")
  })

  it("DefaultThemeScope applies the default palette (restores theme on leave)", () => {
    render(
      <DefaultThemeScope>
        <p>contenido</p>
      </DefaultThemeScope>
    )

    expect(
      document.documentElement.style.getPropertyValue("--accent")
    ).toBe("rgb(255, 122, 33)")
    expect(
      document.documentElement.style.getPropertyValue("--bg-base")
    ).toBe("rgb(15, 17, 18)")
  })
})