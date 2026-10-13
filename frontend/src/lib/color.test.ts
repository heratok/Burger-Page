import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  hexToHsl,
  normalizeHex,
  onColor,
  readableFill,
  readableOn,
  relativeLuminance,
} from "./color"

describe("relativeLuminance / contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5)
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5)
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1)
  })

  it("matches the known merchant brand ratios on white", () => {
    expect(contrastRatio("#e63946", "#ffffff")).toBeCloseTo(4.16, 1)
    expect(contrastRatio("#ff7a21", "#ffffff")).toBeCloseTo(2.6, 1)
  })

  it("is symmetric and accepts 3-digit hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 1)
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1)
  })

  it("normalizes hex and falls back on invalid input", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc")
    expect(normalizeHex("E63946")).toBe("#e63946")
    expect(normalizeHex("nope")).toBeNull()
    expect(normalizeHex(undefined)).toBeNull()
  })
})

describe("readableOn", () => {
  it("returns the brand untouched when it already passes", () => {
    expect(readableOn("#ffffff", "#1d4ed8")).toBe("#1d4ed8")
  })

  it("darkens #e63946 on white to >= 4.5 preserving hue", () => {
    const out = readableOn("#ffffff", "#e63946")
    expect(contrastRatio(out, "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(Math.abs(hexToHsl(out).h - hexToHsl("#e63946").h)).toBeLessThan(6)
  })

  it("darkens #ff7a21 on white to >= 4.5 preserving hue", () => {
    const out = readableOn("#ffffff", "#ff7a21")
    expect(contrastRatio(out, "#ffffff")).toBeGreaterThanOrEqual(4.5)
    expect(Math.abs(hexToHsl(out).h - hexToHsl("#ff7a21").h)).toBeLessThan(6)
  })

  it("handles worst-case yellow on white", () => {
    const out = readableOn("#ffffff", "#ffeb3b")
    expect(contrastRatio(out, "#ffffff")).toBeGreaterThanOrEqual(4.5)
  })

  it("lightens on dark surfaces", () => {
    const out = readableOn("#0f1112", "#3b0764")
    expect(contrastRatio(out, "#0f1112")).toBeGreaterThanOrEqual(4.5)
    expect(relativeLuminance(out)).toBeGreaterThan(relativeLuminance("#3b0764"))
  })

  it("keeps a bright brand unchanged on a dark surface", () => {
    expect(readableOn("#0f1112", "#ff7a21")).toBe("#ff7a21")
  })

  it("satisfies every surface when given several", () => {
    const surfaces = ["#ffffff", "#f8fafc", "#ece2d0"]
    const out = readableOn(surfaces, "#ff7a21")
    for (const s of surfaces) {
      expect(contrastRatio(out, s)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("honours a custom ratio and returns input for invalid colors", () => {
    const out = readableOn("#ffffff", "#ff7a21", 3)
    expect(contrastRatio(out, "#ffffff")).toBeGreaterThanOrEqual(3)
    expect(readableOn("#ffffff", "garbage")).toBe("garbage")
  })
})

describe("onColor", () => {
  it("picks the higher-contrast text color", () => {
    expect(onColor("#0f172a")).toBe("#ffffff")
    expect(onColor("#ffeb3b")).toBe("#0f172a")
    expect(onColor("#ff7a21")).toBe("#0f172a")
    expect(onColor("#ffffff")).toBe("#0f172a")
    expect(onColor("#000000")).toBe("#ffffff")
  })

  it("handles near-white and near-black brands", () => {
    expect(onColor("#fefefe")).toBe("#0f172a")
    expect(onColor("#010101")).toBe("#ffffff")
  })
})

describe("readableFill", () => {
  it("keeps fills that already reach 4.5 with one of the texts", () => {
    expect(readableFill("#ff7a21")).toEqual({ fill: "#ff7a21", text: "#0f172a" })
    expect(readableFill("#1d4ed8")).toEqual({ fill: "#1d4ed8", text: "#ffffff" })
  })

  it("darkens #e63946 minimally so white text passes", () => {
    const { fill, text } = readableFill("#e63946")
    expect(text).toBe("#ffffff")
    expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(4.5)
    expect(fill).not.toBe("#e63946")
    expect(contrastRatio(fill, "#e63946")).toBeLessThan(1.2)
    expect(Math.abs(hexToHsl(fill).h - hexToHsl("#e63946").h)).toBeLessThan(6)
  })

  it("always yields >= 4.5 between fill and text across a hue sweep", () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [30, 40, 50, 60]) {
        const hex = hslHex(h, 80, l)
        const { fill, text } = readableFill(hex)
        expect(contrastRatio(text, fill), hex).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

function hslHex(h: number, s: number, l: number): string {
  const sl = s / 100
  const ll = l / 100
  const a = sl * Math.min(ll, 1 - ll)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
