import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"
import { ImageIcon } from "lucide-react"

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  containerClassName?: string
  fallbackClassName?: string
  fallbackIcon?: React.ReactNode
  showSkeleton?: boolean
}

/**
 * LazyImage Component
 * - Displays a shimmer skeleton while the image is downloading and decoding.
 * - Smoothly transitions (fades in) once the image is ready, preventing jarring flashes.
 * - Gracefully renders a resilient fallback placeholder if the image fails or is empty.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  fallbackClassName,
  fallbackIcon,
  showSkeleton = true,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Reset states if src changes
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
  }, [src])

  if (!src || hasError) {
    return (
      <div
        data-testid="lazy-image-fallback"
        className={cn(
          "flex size-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500",
          containerClassName,
          fallbackClassName
        )}
      >
        {fallbackIcon || <ImageIcon className="size-6 opacity-60" />}
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {isLoading && showSkeleton && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  )
}
