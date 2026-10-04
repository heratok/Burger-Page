import type { AppView } from "@/types/restaurant"

/** Height of the sticky admin header (`h-16` in AdminLayout). */
export const ADMIN_HEADER_HEIGHT_PX = 64

/** Breathing room between the admin header and a toast. */
const ADMIN_TOAST_GAP_PX = 8

/**
 * Top offsets for the app toaster. In the admin panel toasts are pushed below
 * the sticky header so they never sit on top of its primary actions (e.g.
 * "Nueva Venta"); elsewhere Sonner's defaults apply.
 */
export function getToasterOffset(view: AppView): { top?: number; mobileTop?: number } {
  if (view !== "admin") return { top: undefined, mobileTop: undefined }
  const top = ADMIN_HEADER_HEIGHT_PX + ADMIN_TOAST_GAP_PX
  return { top, mobileTop: top }
}
