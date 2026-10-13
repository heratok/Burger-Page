import * as React from "react"

/**
 * ModalShell: accessible wrapper for the custom `fixed inset-0` overlays.
 *
 * Gives every custom modal the behaviour the base-ui Dialog already has:
 * - role="dialog" + aria-modal (name via aria-labelledby / aria-label from props)
 * - focus moves in on open (data-modal-initial-focus > existing autoFocus > first tabbable > container)
 * - Tab / Shift+Tab are trapped inside the dialog
 * - Escape calls onClose, only for the topmost modal and only when no inner widget
 *   (ModernSelect, inline editor...) already consumed it. No onClose = not dismissable.
 * - focus returns to the element focused before opening
 * - body scroll lock (ref-counted so stacked modals restore correctly)
 * - siblings of the dialog's ancestor chain are made `inert` while open
 *
 * Visuals are untouched: the shell renders the same div the modals already used.
 */

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]'

/** Open shells in registration order. Used to decide which one is topmost. */
const openShells: HTMLElement[] = []

let scrollLocks = 0
let savedOverflow = ""
let savedPaddingRight = ""

function lockScroll() {
  if (scrollLocks++ > 0) return
  const body = document.body
  savedOverflow = body.style.overflow
  savedPaddingRight = body.style.paddingRight
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  body.style.overflow = "hidden"
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
}

function unlockScroll() {
  if (--scrollLocks > 0) return
  scrollLocks = 0
  document.body.style.overflow = savedOverflow
  document.body.style.paddingRight = savedPaddingRight
}

/** Nested shells (a shell inside another shell's DOM) win over their parent. */
function getTopmost(): HTMLElement | undefined {
  let top = openShells[openShells.length - 1]
  if (!top) return undefined
  let inner = openShells.find((el) => el !== top && top.contains(el))
  while (inner) {
    top = inner
    const current: HTMLElement = top
    inner = openShells.find((el) => el !== current && current.contains(el))
  }
  return top
}

const layoutAvailable = () => document.documentElement.getClientRects().length > 0

function getTabbables(root: HTMLElement): HTMLElement[] {
  const withLayout = layoutAvailable()
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => {
    if (el.closest("[inert],[hidden]")) return false
    if (el.getAttribute("aria-hidden") === "true") return false
    if (withLayout) {
      if (el.getClientRects().length === 0) return false
      if (getComputedStyle(el).visibility === "hidden") return false
    }
    return true
  })
}

const KEEP_LIVE = "[data-sonner-toaster],[aria-live],[role='status'],[role='alert']"

/** Marks siblings along the ancestor chain as inert. Returns the elements it marked. */
function inertBackground(shell: HTMLElement): HTMLElement[] {
  const marked: HTMLElement[] = []
  let node: HTMLElement = shell
  while (node.parentElement && node !== document.body) {
    const parent: HTMLElement = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue
      if (sibling.hasAttribute("inert")) continue
      if (["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) continue
      if (sibling.matches(KEEP_LIVE) || sibling.querySelector(KEEP_LIVE)) continue
      sibling.setAttribute("inert", "")
      marked.push(sibling)
    }
    node = parent
  }
  return marked
}

export interface ModalShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  /** Called on Escape (topmost modal only). Omit for modals that must not be dismissed. */
  onClose?: () => void
  role?: "dialog" | "alertdialog"
}

export function ModalShell({
  onClose,
  role = "dialog",
  className,
  onKeyDown,
  children,
  ...rest
}: ModalShellProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Captured during the first render, before autoFocus fields steal focus.
  const previouslyFocused = React.useRef<Element | null>(
    typeof document === "undefined" ? null : document.activeElement
  )
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  })

  React.useEffect(() => {
    const shell = ref.current
    if (!shell) return
    openShells.push(shell)
    lockScroll()
    const inerted = inertBackground(shell)

    const active = document.activeElement
    if (!active || !shell.contains(active) || active === shell) {
      const preferred = shell.querySelector<HTMLElement>("[data-modal-initial-focus]")
      const target = preferred ?? getTabbables(shell)[0] ?? shell
      target.focus({ preventScroll: true })
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      if (getTopmost() !== shell) return
      const focused = document.activeElement
      // Focus lives in a portal (select listbox, nested base-ui dialog...): it owns Escape.
      if (focused && focused !== document.body && !shell.contains(focused)) return
      const close = onCloseRef.current
      if (!close) return
      e.preventDefault()
      close()
    }
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("keydown", handleEscape)
      const index = openShells.indexOf(shell)
      if (index >= 0) openShells.splice(index, 1)
      for (const el of inerted) el.removeAttribute("inert")
      unlockScroll()
      const previous = previouslyFocused.current
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (e.key !== "Tab" || e.defaultPrevented) return
    const shell = ref.current
    if (!shell || getTopmost() !== shell) return
    const focused = document.activeElement
    if (!focused || !shell.contains(focused)) return
    const tabbables = getTabbables(shell)
    if (tabbables.length === 0) {
      e.preventDefault()
      shell.focus()
      return
    }
    const first = tabbables[0]
    const last = tabbables[tabbables.length - 1]
    if (e.shiftKey && (focused === first || focused === shell)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && focused === last) {
      e.preventDefault()
      first.focus()
    } else if (focused === shell) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      {...rest}
      ref={ref}
      role={role}
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={className ? `${className} outline-none` : "outline-none"}
    >
      {children}
    </div>
  )
}
