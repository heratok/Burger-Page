import { useRef, useState, useEffect, useCallback } from "react"

export interface UseHorizontalScrollOptions {
  step?: number
  externalRef?: React.RefObject<HTMLDivElement>
}

export function useHorizontalScroll(options: UseHorizontalScrollOptions = {}) {
  const { step = 240, externalRef } = options
  const internalRef = useRef<HTMLDivElement>(null)
  const scrollRef = (externalRef || internalRef) as React.RefObject<HTMLDivElement>

  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeftStart = useRef(0)
  const dragDistance = useRef(0)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [scrollRef])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return

    el.addEventListener("scroll", checkScroll, { passive: true })
    window.addEventListener("resize", checkScroll)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [checkScroll, scrollRef])

  const scrollByAmount = (amount: number) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" })
  }

  const scrollLeft = () => scrollByAmount(-step)
  const scrollRight = () => scrollByAmount(step)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return
    isDragging.current = true
    dragDistance.current = 0
    const pageX = e.pageX ?? e.clientX ?? 0
    startX.current = pageX - (scrollRef.current.offsetLeft || 0)
    scrollLeftStart.current = scrollRef.current.scrollLeft
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return
    const pageX = e.pageX ?? e.clientX ?? 0
    const x = pageX - (scrollRef.current.offsetLeft || 0)
    const walk = x - startX.current
    dragDistance.current = Math.abs(walk)
    if (dragDistance.current > 4) {
      scrollRef.current.scrollLeft = scrollLeftStart.current - walk
    }
  }

  const handleMouseUp = () => {
    isDragging.current = false
    setTimeout(() => {
      dragDistance.current = 0
    }, 50)
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY
      checkScroll()
    }
  }

  const handleItemClick = (callback: () => void) => {
    if (dragDistance.current > 5) {
      return
    }
    callback()
  }

  return {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    scrollLeft,
    scrollRight,
    checkScroll,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleItemClick,
  }
}
