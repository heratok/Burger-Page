import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { StoreBootLoader } from "./LoadingFallbacks"

describe("StoreBootLoader", () => {
  afterEach(cleanup)

  it("is a neutral status loader: no store skeleton cards and no admin copy", () => {
    const { container } = render(<StoreBootLoader />)

    expect(screen.getByRole("status", { name: "Cargando" })).toBeDefined()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
    expect(screen.queryByText(/Panel Administrativo/i)).toBeNull()
  })
})
