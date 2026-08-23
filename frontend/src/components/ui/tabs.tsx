import React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (val: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

export const Tabs: React.FC<{
  value: string
  onValueChange: (val: string) => void
  children: React.ReactNode
  className?: string
}> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export const TabsList: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-start rounded-xl bg-muted/60 p-1 text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

export const TabsTrigger: React.FC<{
  value: string
  children: React.ReactNode
  className?: string
  badge?: number | string
  icon?: React.ReactNode
}> = ({ value, children, className, badge, icon }) => {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsTrigger must be used inside Tabs")

  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-card text-foreground shadow-sm font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-card/40",
        className
      )}
    >
      {icon && <span className="size-4 shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && badge !== null && (
        <span
          className={cn(
            "ml-1 inline-flex size-5 items-center justify-center rounded-full text-xs font-bold",
            isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export const TabsContent: React.FC<{
  value: string
  children: React.ReactNode
  className?: string
}> = ({ value, children, className }) => {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsContent must be used inside Tabs")

  if (ctx.value !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn("mt-4 focus-visible:outline-none", className)}
    >
      {children}
    </div>
  )
}
