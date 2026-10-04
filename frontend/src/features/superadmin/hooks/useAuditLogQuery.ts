import { useCallback, useMemo } from "react"
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { apiClient, type AuditLogPage, type AuditLogQuery } from "@/core/api/apiClient"
import { useAuth } from "@/context/slices/AuthContext"
import { keys } from "@/core/query/keys"

export const AUDIT_LOG_PAGE_SIZE = 25

export interface AuditLogFilters {
  action?: string
  restaurantId?: string
  from?: string
  to?: string
}

/**
 * Cursor-paginated audit log. The filters are part of the key, so a response
 * for a previous filter (first page or "load more") can only ever land in that
 * filter's cache entry, never in the list on screen.
 */
export function useAuditLogQuery(filters: AuditLogFilters) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { action, restaurantId, from, to } = filters
  const queryKey = useMemo(
    () => keys.auditLog(session.role, { action, restaurantId, from, to }),
    [session.role, action, restaurantId, from, to]
  )

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      const params: Record<string, unknown> = { limit: AUDIT_LOG_PAGE_SIZE }
      if (pageParam) params.cursor = pageParam
      if (action) params.action = action
      if (restaurantId) params.restaurantId = restaurantId
      if (from) params.from = from
      if (to) params.to = to
      return apiClient.fetchAuditLog(params as AuditLogQuery)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AuditLogPage) => lastPage.nextCursor || undefined,
    retry: false,
  })

  // A reload starts over from the first page: later pages are dropped before
  // the refetch (an infinite query would otherwise refetch every loaded page).
  const { refetch } = query
  const reload = useCallback(() => {
    queryClient.setQueryData<InfiniteData<AuditLogPage, string | undefined>>(queryKey, (data) =>
      data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data
    )
    return refetch()
  }, [queryClient, queryKey, refetch])

  return { ...query, reload }
}
