import { afterEach, describe, expect, it } from "vitest"
import { applyAccent } from "./theme"

function parseRgb(value: string): { r: number; g: number; b: number } {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value)
  if (!match) throw new Error(`Unexpected rgb value: ${value}`)
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
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
    const accent = relativeLuminance(parseRgb(style.getPropertyValue("--color-accent")))
    const hover = relativeLuminance(parseRgb(style.getPropertyValue("--color-accent-hover")))
    const pressed = relativeLuminance(parseRgb(style.getPropertyValue("--color-accent-pressed")))

    expect(hover).toBeGreaterThan(accent)
    expect(pressed).toBeLessThan(accent)
  })

  it("throws on invalid hex input", () => {
    expect(() => applyAccent("naranja")).toThrow()
    expect(() => applyAccent("#FF7A2")).toThrow()
  })
})