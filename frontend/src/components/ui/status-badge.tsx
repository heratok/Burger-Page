import React from "react"
import { cn } from "@/lib/utils"
import type { OrderStatus, LoyaltyTier } from "@/types/restaurant"
import { Clock, ChefHat, Bike, CheckCircle2, XCircle, Crown, Award, Medal, Shield } from "lucide-react"

interface StatusBadgeProps {
  status: OrderStatus
  className?: string
  pulse?: boolean
}

export const OrderStatusBadge: React.FC<StatusBadgeProps> = ({ status, className, pulse }) => {
  const configs: Record<
    OrderStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode; dot: string }
  > = {
    pending: {
      label: "Nuevo / Pendiente",
      bg: "bg-amber-500/15 dark:bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
      dot: "bg-amber-500",
      icon: <Clock className="size-3.5" />,
    },
    cooking: {
      label: "En Cocina",
      bg: "bg-orange-500/15 dark:bg-orange-500/20",
      text: "text-orange-700 dark:text-orange-300",
      border: "border-orange-500/30",
      dot: "bg-orange-500",
      icon: <ChefHat className="size-3.5" />,
    },
    delivering: {
      label: "En Reparto",
      bg: "bg-blue-500/15 dark:bg-blue-500/20",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-500/30",
      dot: "bg-blue-500",
      icon: <Bike className="size-3.5" />,
    },
    delivered: {
      label: "Entregado",
      bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
      dot: "bg-emerald-500",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    cancelled: {
      label: "Cancelado",
      bg: "bg-rose-500/15 dark:bg-rose-500/20",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-500/30",
      dot: "bg-rose-500",
      icon: <XCircle className="size-3.5" />,
    },
  }

  const current = configs[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all",
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      {pulse && status === "pending" && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
      )}
      {!pulse && current.icon}
      <span>{current.label}</span>
    </span>
  )
}

interface LoyaltyBadgeProps {
  tier: LoyaltyTier
  className?: string
}

export const LoyaltyBadge: React.FC<LoyaltyBadgeProps> = ({ tier, className }) => {
  const configs: Record<
    LoyaltyTier,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    vip: {
      label: "Cliente VIP",
      bg: "bg-gradient-to-r from-purple-500/20 to-pink-500/20",
      text: "text-purple-700 dark:text-purple-300 font-bold",
      border: "border-purple-500/40 shadow-xs",
      icon: <Crown className="size-3.5 text-amber-500" />,
    },
    gold: {
      label: "Oro",
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
      icon: <Award className="size-3.5 text-amber-600 dark:text-amber-400" />,
    },
    silver: {
      label: "Plata",
      bg: "bg-slate-400/15",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-400/30",
      icon: <Medal className="size-3.5 text-slate-500" />,
    },
    bronze: {
      label: "Bronce",
      bg: "bg-orange-800/10",
      text: "text-orange-900 dark:text-orange-300",
      border: "border-orange-700/20",
      icon: <Shield className="size-3.5 text-orange-700 dark:text-orange-400" />,
    },
  }

  const current = configs[tier]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      {current.icon}
      <span>{current.label}</span>
    </span>
  )
}
