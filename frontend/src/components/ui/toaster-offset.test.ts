import { describe, it, expect } from "vitest"
import { ADMIN_HEADER_HEIGHT_PX, getToasterClipPath, getToasterOffset } from "./toaster-offset"

describe("getToasterOffset", () => {
  it("keeps admin toasts below the sticky admin header so they never cover its actions", () => {
    const offset = getToasterOffset("admin")
    expect(offset.top).toBeGreaterThan(ADMIN_HEADER_HEIGHT_PX)
  })

  it("applies the same clearance on mobile as on desktop for the admin panel", () => {
    expect(getToasterOffset("admin").mobileTop).toBeGreaterThan(ADMIN_HEADER_HEIGHT_PX)
  })

  it("leaves the default Sonner offsets untouched outside the admin panel", () => {
    expect(getToasterOffset("store")).toEqual({ top: undefined, mobileTop: undefined })
  })
})

describe("getToasterClipPath", () => {
  it("clips admin toasts at the bottom edge of the header so they never cross it while sliding in or out", () => {
    const top = getToasterOffset("admin").top!
    const clipPath = getToasterClipPath("admin")
    const clipAbovePx = Number(/^inset\(-(\d+)px /.exec(clipPath ?? "")?.[1])
    expect(top - clipAbovePx).toBe(ADMIN_HEADER_HEIGHT_PX)
  })

  it("does not clip toasts outside the admin panel", () => {
    expect(getToasterClipPath("store")).toBeUndefined()
  })
})
