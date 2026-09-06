import { describe, it, expect } from "vitest"
import { nextTempId } from "./ids"

describe("lib/ids — nextTempId", () => {
  it("returns a string shaped `prefix-<uuid>` for the given prefix", () => {
    const id = nextTempId("ord")
    // crypto.randomUUID() produces 8-4-4-4-12 hex chars separated by dashes
    expect(id).toMatch(/^ord-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it("uses the exact prefix supplied by the caller", () => {
    expect(nextTempId("prod").startsWith("prod-")).toBe(true)
    expect(nextTempId("inv").startsWith("inv-")).toBe(true)
    expect(nextTempId("rest").startsWith("rest-")).toBe(true)
  })

  it("produces unique ids across many same-tick calls (collision-free under Date.now() collisions)", () => {
    const N = 1000
    const ids = new Set<string>()
    for (let i = 0; i < N; i++) {
      ids.add(nextTempId("ord"))
    }
    expect(ids.size).toBe(N)
  })

  it("different prefixes do not share id space and stay unique within each", () => {
    const a = nextTempId("ord")
    const b = nextTempId("prod")
    expect(a.startsWith("ord-")).toBe(true)
    expect(b.startsWith("prod-")).toBe(true)
    expect(a).not.toBe(b)
  })
})
