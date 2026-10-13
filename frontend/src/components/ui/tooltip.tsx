import { cloneElement, useId, useState, type ReactElement, type ReactNode } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

type TooltipProps = {
  /** Text shown on hover AND keyboard focus; also announced as the trigger description. */
  content: ReactNode
  /** A single focusable element (button, link, or an element with tabIndex={0}). */
  children: ReactElement
  side?: "top" | "bottom" | "left" | "right"
  className?: string
  /** Render the child untouched (e.g. when the label is already visible). */
  disabled?: boolean
}

/**
 * Accessible replacement for the native `title` tooltip.
 * - Shown on hover and on keyboard focus, dismissed with Escape or blur.
 * - Popup has role="tooltip" and the trigger gets aria-describedby while it is open.
 * - Hovering the popup keeps it open (WCAG 1.4.13); no timeouts hide it.
 * The accessible NAME of the trigger must still come from aria-label or visible text.
 */
function Tooltip({ content, children, side = "top", className, disabled }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const trigger = cloneElement(children, open ? { "aria-describedby": id } : {})
  return (
    <TooltipPrimitive.Root open={open && !disabled} onOpenChange={setOpen} disabled={disabled}>
      <TooltipPrimitive.Trigger
        delay={200}
        closeOnClick={false}
        render={trigger}
      />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-[9999]">
          <TooltipPrimitive.Popup
            id={id}
            role="tooltip"
            className={cn(
              "max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip }

/**
 * Explains WHY a control is disabled. A disabled button is not focusable and swallows
 * hover, so its reason is wrapped in a focusable group that shows the tooltip.
 * Renders children untouched when there is no reason.
 */
function DisabledReason({ reason, children }: { reason?: string | null; children: ReactElement }) {
  if (!reason) return children
  return (
    <Tooltip content={reason}>
      <span role="group" tabIndex={0} aria-label={reason} className="inline-flex rounded-lg">
        {children}
      </span>
    </Tooltip>
  )
}

export { DisabledReason }
