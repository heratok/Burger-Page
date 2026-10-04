import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

export interface ToasterComponentProps extends ToasterProps {
  themeStyles?: React.CSSProperties
}

const Toaster = ({ theme, themeStyles, style, ...props }: ToasterComponentProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          ...themeStyles,
          "--normal-bg": "var(--color-bg-elevated, #212529)",
          "--normal-text": "var(--color-text-primary, #F5F5F7)",
          "--normal-border": "var(--color-border-subtle, #2D3138)",
          "--border-radius": "var(--radius-lg, 16px)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
