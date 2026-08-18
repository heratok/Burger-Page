import { afterEach, describe, expect, it } from "vitest"
import {
  applyAccent,
  applyTheme,
  chartPalette,
  contrastRatio,
  relativeLuminance,
} from "./theme"
import { DEFAULT_PALETTE } from "../data/data"
import type { RestaurantPalette } from "./domain"

function parseRgb(value: string): { r: number; g: number; b: number } {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value)
  if (!match) throw new Error(`Unexpected rgb value: ${value}`)
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

function rgbStringToHex(value: string): string {
  const { r, g, b } = parseRgb(value)
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function luminanceOf({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const LIGHT_PALETTE: RestaurantPalette = {
  accent: "#FFD60A",
  primary: "#FFD60A",
  background: "#FFFFFF",
  surface: "#F2F2F2",
}

afterEach(() => {
  document.documentElement.style.cssText = ""
})

describe("applyAccent", () => {
  it("sets the four accent CSS variables from the input hex", () => {
    applyAccent("#FF7A21")
    const style = document.documentElement.style
    expect(style.getPropertyValue("--color-accent")).toBe("rgb(255, 122, 33)")
    expect(style.getPropertyValue("--color-accent-hover")).toBe("rgb(255, 142, 66)")
    expect(style.getPropertyValue("--color-accent-pressed")).toBe("rgb(224, 107, 29)")
    expect(style.getPropertyValue("--color-accent-soft")).toBe("rgba(255, 122, 33, 0.12)")
  })

  it("keeps the soft shade at 12% alpha of the accent for any input", () => {
    applyAccent("#123456")
    expect(document.documentElement.style.getPropertyValue("--color-accent-soft")).toBe(
      "rgba(18, 52, 86, 0.12)"
    )
  })

  it("derives hover lighter than accent and pressed darker than accent", () => {
    applyAccent("#FF7A21")
    const style = document.documentElement.style
    const accent = luminanceOf(parseRgb(style.getPropertyValue("--color-accent")))
    const hover = luminanceOf(parseRgb(style.getPropertyValue("--color-accent-hover")))
    const pressed = luminanceOf(parseRgb(style.getPropertyValue("--color-accent-pressed")))

    expect(hover).toBeGreaterThan(accent)
    expect(pressed).toBeLessThan(accent)
  })

  it("throws on invalid hex input", () => {
    expect(() => applyAccent("naranja")).toThrow()
    expect(() => applyAccent("#FF7A2")).toThrow()
  })
})

describe("relativeLuminance / contrastRatio", () => {
  it("computes the WCAG relative luminance of black and white", () => {
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#FFFFFF")).toBe(1)
  })

  it("computes the WCAG contrast ratio between two colors", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBe(21)
    expect(contrastRatio("#FFD60A", "#0F1112")).toBeCloseTo(13.4, 1)
    expect(contrastRatio("#0F1112", "#FFD60A")).toBeCloseTo(13.4, 1)
  })
})

describe("applyTheme", () => {
  it("sets every derived runtime variable from the default palette (TH-1)", () => {
    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style
    const expected: Record<string, string> = {
      "--accent": "rgb(255, 122, 33)",
      "--accent-hover": "rgb(255, 142, 66)",
      "--accent-pressed": "rgb(224, 107, 29)",
      "--accent-soft": "rgba(255, 122, 33, 0.12)",
      "--accent-foreground": "rgb(245, 245, 247)",
      "--primary-foreground": "rgb(245, 245, 247)",
      "--bg-base": "rgb(15, 17, 18)",
      "--bg-surface": "rgb(24, 26, 27)",
      "--bg-elevated": "rgb(34, 36, 37)",
      "--bg-elevated-2": "rgb(46, 48, 49)",
      "--bg-input": "rgb(27, 29, 30)",
      "--border-subtle": "rgb(49, 50, 51)",
      "--border-strong": "rgb(63, 65, 65)",
      "--text-primary": "rgb(245, 245, 247)",
      "--text-secondary": "rgb(199, 199, 201)",
      "--text-muted": "rgb(142, 142, 144)",
      "--primary": "rgb(255, 122, 33)",
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(style.getPropertyValue(name)).toBe(value)
    }
  })

  it("maps every shadcn alias to its source runtime variable (TH-1 Mapping)", () => {
    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style
    // Alias table from the design (D3): alias -> source var -> derived value.
    const aliases: Array<[string, string, string]> = [
      ["background", "--bg-base", "rgb(15, 17, 18)"],
      ["foreground", "--text-primary", "rgb(245, 245, 247)"],
      ["card", "--bg-elevated", "rgb(34, 36, 37)"],
      ["card-foreground", "--text-primary", "rgb(245, 245, 247)"],
      ["popover", "--bg-elevated", "rgb(34, 36, 37)"],
      ["popover-foreground", "--text-primary", "rgb(245, 245, 247)"],
      ["secondary", "--bg-elevated-2", "rgb(46, 48, 49)"],
      ["secondary-foreground", "--text-primary", "rgb(245, 245, 247)"],
      ["muted", "--bg-input", "rgb(27, 29, 30)"],
      ["muted-foreground", "--text-muted", "rgb(142, 142, 144)"],
      ["input", "--bg-input", "rgb(27, 29, 30)"],
      ["ring", "--primary", "rgb(255, 122, 33)"],
      ["border", "--border-subtle", "rgb(49, 50, 51)"],
    ]
    for (const [alias, sourceVar, value] of aliases) {
      // The alias token resolves through the CSS chain; the source var is what
      // applyTheme sets at runtime, so assert the source holds the alias value.
      expect(style.getPropertyValue(sourceVar), `alias ${alias} -> ${sourceVar}`).toBe(value)
      expect(
        style.getPropertyValue(`--color-${sourceVar.slice(2)}`),
        `twin of ${sourceVar}`
      ).toBe(value)
    }
  })

  it("derives a dark accent-foreground for a light accent (TH-2 #FFD60A)", () => {
    applyTheme({ ...DEFAULT_PALETTE, accent: "#FFD60A", primary: "#FFD60A" })
    const style = document.documentElement.style

    expect(style.getPropertyValue("--accent-foreground")).toBe("rgb(15, 17, 18)")
    const contrast = contrastRatio("#FFD60A", rgbStringToHex(style.getPropertyValue("--accent-foreground")))
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps derived text at WCAG AA (>= 4.5:1) on the dark default palette", () => {
    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style
    const bg = DEFAULT_PALETTE.background

    for (const name of ["--text-primary", "--text-secondary", "--text-muted"]) {
      const contrast = contrastRatio(bg, rgbStringToHex(style.getPropertyValue(name)))
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("keeps derived text at WCAG AA (>= 4.5:1) on a light palette", () => {
    applyTheme(LIGHT_PALETTE)
    const style = document.documentElement.style

    expect(style.getPropertyValue("--text-primary")).toBe("rgb(15, 17, 18)")
    expect(style.getPropertyValue("--bg-elevated")).toBe("rgb(235, 235, 235)")

    for (const name of ["--text-primary", "--text-secondary", "--text-muted"]) {
      const contrast = contrastRatio(LIGHT_PALETTE.background, rgbStringToHex(style.getPropertyValue(name)))
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("steps the muted blend down until contrast holds on a light palette (TH-2 fallback)", () => {
    applyTheme(LIGHT_PALETTE)
    const style = document.documentElement.style

    // 0.45 blend would be rgb(123, 124, 125) at 4.18:1 — stepped to 0.40.
    expect(style.getPropertyValue("--text-muted")).toBe("rgb(111, 112, 113)")
  })

  it("restores the default theme when applied after a custom palette (TH-2 Switch)", () => {
    applyTheme(LIGHT_PALETTE)
    expect(document.documentElement.style.getPropertyValue("--text-primary")).toBe("rgb(15, 17, 18)")

    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style
    expect(style.getPropertyValue("--text-primary")).toBe("rgb(245, 245, 247)")
    expect(style.getPropertyValue("--bg-base")).toBe("rgb(15, 17, 18)")
    expect(style.getPropertyValue("--accent-foreground")).toBe("rgb(245, 245, 247)")
    expect(style.getPropertyValue("--bg-elevated")).toBe("rgb(34, 36, 37)")
  })

  it("leaves destructive, success and warning tokens untouched", () => {
    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style

    expect(style.getPropertyValue("--color-destructive")).toBe("")
    expect(style.getPropertyValue("--color-success")).toBe("")
    expect(style.getPropertyValue("--color-warning")).toBe("")
  })
})

describe("chartPalette (AS-4)", () => {
  const HEX = /^#[0-9a-f]{6}$/i

  it("derives 5 contrast-distinct colors even when accent equals primary", () => {
    const colors = chartPalette("#FF7A21", "#FF7A21")

    expect(colors).toHaveLength(5)
    for (const color of colors) {
      expect(color).toMatch(HEX)
    }
    expect(new Set(colors).size).toBe(5)
  })

  it("anchors the ramp on the accent and keeps the colors distinct", () => {
    const colors = chartPalette("#E63946", "#2A9D8F")

    expect(colors[0]).toBe("#e63946")
    expect(new Set(colors).size).toBe(5)
  })

  it("is deterministic for the same inputs", () => {
    const first = chartPalette("#FF7A21", "#2A9D8F")
    const second = chartPalette("#FF7A21", "#2A9D8F")
    expect(first).toEqual(second)
  })
})

describe("applyTheme sidebar/chart tokens (AS-4)", () => {
  it("writes every --sidebar-* token derived from the palette, never hardcoded hex", () => {
    applyTheme(DEFAULT_PALETTE)
    const style = document.documentElement.style

    expect(style.getPropertyValue("--sidebar")).toBe("rgb(24, 26, 27)")
    expect(style.getPropertyValue("--sidebar-foreground")).toBe("rgb(245, 245, 247)")
    expect(style.getPropertyValue("--sidebar-primary")).toBe("rgb(255, 122, 33)")
    expect(style.getPropertyValue("--sidebar-primary-foreground")).toBe("rgb(245, 245, 247)")
    expect(style.getPropertyValue("--sidebar-accent")).toBe("rgb(255, 122, 33)")
    expect(style.getPropertyValue("--sidebar-accent-foreground")).toBe("rgb(245, 245, 247)")
    expect(style.getPropertyValue("--sidebar-border")).toBe("rgb(49, 50, 51)")
    expect(style.getPropertyValue("--sidebar-ring")).toBe("rgb(255, 122, 33)")
  })

  it("writes five --chart-N tokens that derive from the accent palette", () => {
    applyTheme({ ...DEFAULT_PALETTE, accent: "#E63946", primary: "#E63946" })
    const style = document.documentElement.style

    expect(style.getPropertyValue("--chart-1")).toBe("rgb(230, 57, 70)")
    const chartTokens = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]
      .map((name) => style.getPropertyValue(name))
    // All resolved, no empty values.
    for (const value of chartTokens) {
      expect(value).not.toBe("")
    }
  })

  it("re-derives the chart tokens from a switched palette (AS-3 theme switch)", () => {
    applyTheme({ ...DEFAULT_PALETTE, accent: "#2A9D8F", primary: "#2A9D8F" })
    expect(
      document.documentElement.style.getPropertyValue("--chart-1")
    ).toBe("rgb(42, 157, 143)")
  })
})