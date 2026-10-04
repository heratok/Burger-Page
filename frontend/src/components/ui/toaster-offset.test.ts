import { describe, it, expect } from "vitest"
import { ADMIN_HEADER_HEIGHT_PX, getToasterOffset } from "./toaster-offset"

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
