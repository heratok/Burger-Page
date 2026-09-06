import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline" | "filled" | "ghost"
  containerClassName?: string
  options?: (SelectOption | SelectGroup)[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      leftIcon,
      size = "md",
      variant = "default",
      disabled,
      children,
      options,
      ...props
    },
    ref
  ) => {
    // Size variants
    const sizeClasses = {
      sm: "h-8 py-1 text-xs pl-2.5 pr-7 rounded-lg",
      md: "h-9.5 py-1.5 text-xs sm:text-sm pl-3 pr-8 rounded-xl",
      lg: "h-11 py-2 text-sm pl-3.5 pr-9 rounded-xl",
    }

    const iconSizeClasses = {
      sm: "left-2 size-3.5",
      md: "left-2.5 size-4",
      lg: "left-3 size-4.5",
    }

    const rightChevronClasses = {
      sm: "right-2 size-3.5",
      md: "right-2.5 size-4",
      lg: "right-3 size-4.5",
    }

    const leftPaddingWhenIcon = {
      sm: "pl-7",
      md: "pl-8.5",
      lg: "pl-10",
    }

    // Visual styles for variants
    const variantClasses = {
      default:
        "border border-slate-200/90 bg-white text-slate-800 shadow-xs hover:border-slate-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/15 dark:border-slate-700/80 dark:bg-[#0E1322] dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
      outline:
        "border-2 border-slate-200 bg-transparent text-slate-900 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-indigo-400",
      filled:
        "border border-transparent bg-slate-100/90 text-slate-900 hover:bg-slate-200/80 focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:border-indigo-400 dark:focus:bg-slate-900",
      ghost:
        "border-transparent bg-transparent text-slate-700 hover:bg-slate-100/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:text-slate-300 dark:hover:bg-slate-800/60",
    }

    const isGroup = (item: SelectOption | SelectGroup): item is SelectGroup => {
      return "options" in item && Array.isArray((item as SelectGroup).options)
    }

    return (
      <div className={cn("relative flex flex-col gap-1 w-full", containerClassName)}>
        {label && (
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}

        <div className="relative group flex items-center w-full">
          {leftIcon && (
            <div
              className={cn(
                "pointer-events-none absolute flex items-center justify-center text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors z-10",
                iconSizeClasses[size]
              )}
            >
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full appearance-none font-medium outline-none transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 truncate",
              sizeClasses[size],
              variantClasses[variant],
              leftIcon && leftPaddingWhenIcon[size],
              error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500",
              className
            )}
            {...props}
          >
            {options
              ? options.map((item, idx) => {
                  if (isGroup(item)) {
                    return (
                      <optgroup key={`group-${idx}`} label={item.label}>
                        {item.options.map((opt) => (
                          <option
                            key={String(opt.value)}
                            value={opt.value}
                            disabled={opt.disabled}
                            title={opt.label}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    )
                  }
                  return (
                    <option
                      key={String(item.value)}
                      value={item.value}
                      disabled={item.disabled}
                      title={item.label}
                    >
                      {item.label}
                    </option>
                  )
                })
              : children}
          </select>

          <ChevronDown
            className={cn(
              "pointer-events-none absolute text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200 transition-transform duration-200 group-focus-within:rotate-180 z-10",
              rightChevronClasses[size]
            )}
          />
        </div>

        {error && (
          <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
            {error}
          </span>
        )}
      </div>
    )
  }
)

Select.displayName = "Select"
