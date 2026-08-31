import * as React from "react"
import { cn } from "@/lib/utils"

export type StatCardVariant = "default" | "warning" | "success" | "info" | "indigo"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: React.ReactNode
  description?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  iconClassName?: string
  iconBgClassName?: string
  variant?: StatCardVariant
  isDark?: boolean
  onClick?: (e?: React.MouseEvent<HTMLDivElement>) => void
  className?: string
  badge?: React.ReactNode
}

const variantStyles: Record<StatCardVariant, { iconBg: string; text: string }> = {
  default: {
    iconBg: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    text: "text-slate-600 dark:text-slate-400",
  },
  warning: {
    iconBg: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  success: {
    iconBg: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    iconBg: "bg-violet-500/10 text-violet-500 dark:bg-violet-500/20 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
  },
  indigo: {
    iconBg: "bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
  },
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  subtitle,
  icon,
  iconClassName,
  iconBgClassName,
  variant = "default",
  isDark,
  onClick,
  className,
  badge,
  children,
  ...props
}) => {
  const styles = variantStyles[variant] || variantStyles.default
  const resolvedDesc = description ?? subtitle
  const isInteractive = Boolean(onClick)

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "rounded-2xl border p-5 shadow-xs transition-all",
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white",
        isInteractive &&
          "cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isDark ? "text-slate-400" : "text-slate-500"
          )}
        >
          {title}
        </span>
        {icon && (
          <span
            data-testid="stat-card-icon-container"
            className={cn(
              "flex size-9 items-center justify-center rounded-xl",
              styles.iconBg,
              iconBgClassName
            )}
          >
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                  className: cn("size-5", icon.props.className, iconClassName),
                })
              : icon}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          data-testid="stat-card-value"
          className={cn(
            "text-2xl font-black tracking-tight sm:text-3xl",
            isDark ? "text-white" : "text-slate-900"
          )}
        >
          {value}
        </span>
        {badge}
      </div>

      {resolvedDesc && (
        <div
          data-testid="stat-card-description"
          className={cn("mt-2 flex items-center gap-1.5 text-xs", styles.text)}
        >
          {resolvedDesc}
        </div>
      )}

      {children}
    </div>
  )
}
