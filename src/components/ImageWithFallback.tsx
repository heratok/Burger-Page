import { useState } from "react"
import { Utensils } from "lucide-react"

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string
}

export default function ImageWithFallback({
  src,
  alt = "",
  className = "",
  fallbackClassName = "",
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt || "Imagen no disponible"}
        className={`flex items-center justify-center bg-bg-elevated-2 text-text-muted ${className} ${fallbackClassName}`}
      >
        <Utensils className="size-1/3 opacity-40" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
      {...props}
    />
  )
}
