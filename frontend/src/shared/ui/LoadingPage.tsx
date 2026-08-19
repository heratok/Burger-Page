import { Skeleton } from "@/shared/ui/ui/skeleton"

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
      <Skeleton className="aspect-video w-full rounded-none bg-bg-elevated-2" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-2/3 bg-bg-elevated-2" />
        <Skeleton className="h-3 w-full bg-bg-elevated-2" />
        <Skeleton className="h-3 w-5/6 bg-bg-elevated-2" />
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-5 w-20 bg-bg-elevated-2" />
          <Skeleton className="size-9 rounded-full bg-bg-elevated-2" />
        </div>
      </div>
    </div>
  )
}

export default function LoadingPage() {
  return (
    <div className="mx-auto max-w-(--container) px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-40 bg-bg-elevated-2" />
        <Skeleton className="h-4 w-72 bg-bg-elevated-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}