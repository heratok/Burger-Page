import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useHorizontalScroll } from "./useHorizontalScroll"

describe("useHorizontalScroll", () => {
  it("initializes with canScrollLeft and canScrollRight as false", () => {
    const { result } = renderHook(() => useHorizontalScroll())
    expect(result.current.canScrollLeft).toBe(false)
    expect(result.current.canScrollRight).toBe(false)
    expect(result.current.scrollRef.current).toBeNull()
  })

  it("handles mouse wheel event and translates vertical deltaY to horizontal scroll", () => {
    const { result } = renderHook(() => useHorizontalScroll())

    const mockDiv = document.createElement("div")
    mockDiv.scrollLeft = 0
    // @ts-expect-error test assignment
    result.current.scrollRef.current = mockDiv

    act(() => {
      result.current.handleWheel({ deltaY: 80 } as unknown as React.WheelEvent<HTMLDivElement>)
    })

    expect(mockDiv.scrollLeft).toBe(80)
  })

  it("suppresses handleItemClick callback when drag distance is greater than 5px", () => {
    const { result } = renderHook(() => useHorizontalScroll())

    const mockDiv = document.createElement("div")
    // @ts-expect-error test assignment
    result.current.scrollRef.current = mockDiv

    const clickSpy = vi.fn()

    // Normal click without drag
    act(() => {
      result.current.handleItemClick(clickSpy)
    })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    // Simulate drag
    act(() => {
      result.current.handleMouseDown({ clientX: 100, pageX: 100 } as unknown as React.MouseEvent)
    })
    act(() => {
      result.current.handleMouseMove({ clientX: 30, pageX: 30 } as unknown as React.MouseEvent) // 70px drag
    })
    act(() => {
      result.current.handleMouseUp()
    })

    // Click immediately following a drag should be suppressed
    act(() => {
      result.current.handleItemClick(clickSpy)
    })
    expect(clickSpy).toHaveBeenCalledTimes(1) // still 1, suppressed
  })

  it("triggers scrollBy on scrollLeft and scrollRight", () => {
    const { result } = renderHook(() => useHorizontalScroll({ step: 150 }))

    const mockDiv = document.createElement("div")
    mockDiv.scrollBy = vi.fn()
    // @ts-expect-error test assignment
    result.current.scrollRef.current = mockDiv

    act(() => {
      result.current.scrollLeft()
    })
    expect(mockDiv.scrollBy).toHaveBeenCalledWith({ left: -150, behavior: "smooth" })

    act(() => {
      result.current.scrollRight()
    })
    expect(mockDiv.scrollBy).toHaveBeenCalledWith({ left: 150, behavior: "smooth" })
  })
})
