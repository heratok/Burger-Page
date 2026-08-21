import React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onChange"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  className,
  disabled,
  label,
  description,
  id,
  ...props
}) => {
  const switchId = id || `switch-${Math.random().toString(36).slice(2, 9)}`

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        id={switchId}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700",
          disabled && "cursor-not-allowed opacity-50"
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={switchId} className="cursor-pointer text-left select-none">
          {label && (
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {label}
            </div>
          )}
          {description && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {description}
            </div>
          )}
        </label>
      )}
    </div>
  )
}
