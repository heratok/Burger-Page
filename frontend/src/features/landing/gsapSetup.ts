import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

let registered = false

export function ensureLandingGsapRegistered(): void {
  if (registered || !supportsGsapMatchMedia()) return
  gsap.registerPlugin(ScrollTrigger, useGSAP)
  registered = true
}

export function supportsGsapMatchMedia(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    typeof document !== "undefined"
  )
}

export function isFinePointerDevice(): boolean {
  if (!supportsGsapMatchMedia()) return false
  return window.matchMedia("(pointer: fine)").matches
}

export { gsap, ScrollTrigger, useGSAP }
