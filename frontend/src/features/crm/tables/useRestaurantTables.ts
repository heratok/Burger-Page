import { useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
import { useAuth } from "@/context/slices/AuthContext"
import { keys } from "@/core/query/keys"
import type { RestaurantTable } from "@/types/restaurant"

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

export interface UseRestaurantTables {
  tables: RestaurantTable[]
  isLoading: boolean
  loadError: string | null
  reload: () => Promise<void>
  /** Resolves the created table, or null (after an error toast) when rejected. */
  createTable: (name: string) => Promise<RestaurantTable | null>
  updateTable: (id: string, data: { name?: string; isActive?: boolean }) => Promise<boolean>
  moveTable: (id: string, direction: "up" | "down") => Promise<void>
  deleteTable: (id: string) => Promise<boolean>
}

/**
 * Server-backed list of the restaurant tables, cached per tenant and role
 * (keys.tables) and shared by every consumer. Every change goes to the API
 * first (the server owns names and order); the cache is only updated from what
 * it answers, except for reordering, which is optimistic and rolls back.
 * Confirmed writes also mark the list stale so the next mount re-reads it.
 */
export function useRestaurantTables(restaurantId: string | undefined): UseRestaurantTables {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => keys.tables(restaurantId, session.role), [restaurantId, session.role])

  // Tables are staff data: without a session there is nothing to load.
  const enabled = Boolean(restaurantId && apiClient.hasToken())
  const query = useQuery({
    queryKey,
    queryFn: () => apiClient.fetchTables(restaurantId),
    enabled,
    retry: false,
  })

  const tables = useMemo(
    () => (query.isError ? [] : (query.data ?? [])),
    [query.isError, query.data]
  )
  // The first read, and a retry after a failed read, show the loading state.
  const isLoading = enabled && (query.isLoading || (query.isError && query.isFetching))
  const loadError = query.isError ? errorMessage(query.error, "No se pudieron cargar las mesas") : null

  const { refetch } = query
  const reload = useCallback(async () => {
    if (!enabled) return
    await refetch()
  }, [enabled, refetch])

  /** Applies a confirmed server answer to the cache and marks it stale for later mounts. */
  const commit = useCallback(
    (update: (list: RestaurantTable[]) => RestaurantTable[]) => {
      queryClient.setQueryData<RestaurantTable[]>(queryKey, (list) => update(list ?? []))
      void queryClient.invalidateQueries({ queryKey, refetchType: "none" })
    },
    [queryClient, queryKey]
  )

  const { mutateAsync: create } = useMutation({
    mutationFn: (name: string) => apiClient.createTable(name, restaurantId),
    onSuccess: (created) => commit((list) => [...list, created]),
  })
  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; isActive?: boolean } }) =>
      apiClient.updateTable(id, data, restaurantId),
    onSuccess: (updated, { id }) => commit((list) => list.map((t) => (t.id === id ? updated : t))),
  })
  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => apiClient.deleteTable(id, restaurantId),
    onSuccess: (_result, id) => commit((list) => list.filter((t) => t.id !== id)),
  })
  const { mutateAsync: reorder } = useMutation({
    mutationFn: ({ next }: { next: RestaurantTable[]; previous: RestaurantTable[] }) =>
      apiClient.reorderTables(next.map((t) => t.id), restaurantId),
    onMutate: async ({ next }) => {
      // A read that predates the reorder must not overwrite it.
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<RestaurantTable[]>(queryKey, next)
    },
    onError: (err, { previous }) => {
      queryClient.setQueryData<RestaurantTable[]>(queryKey, previous)
      toast.error(errorMessage(err, "No se pudo reordenar las mesas"))
    },
    onSuccess: (ordered) => commit(() => ordered),
  })

  const createTable = useCallback(
    async (name: string) => {
      try {
        return await create(name)
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo crear la mesa"))
        return null
      }
    },
    [create]
  )

  const updateTable = useCallback(
    async (id: string, data: { name?: string; isActive?: boolean }) => {
      try {
        await update({ id, data })
        return true
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo actualizar la mesa"))
        return false
      }
    },
    [update]
  )

  const moveTable = useCallback(
    async (id: string, direction: "up" | "down") => {
      const index = tables.findIndex((t) => t.id === id)
      const target = direction === "up" ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= tables.length) return

      const next = [...tables]
      ;[next[index], next[target]] = [next[target], next[index]]
      // The mutation owns the rollback and the error toast.
      await reorder({ next, previous: tables }).catch(() => undefined)
    },
    [tables, reorder]
  )

  const deleteTable = useCallback(
    async (id: string) => {
      try {
        await remove(id)
        return true
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo eliminar la mesa"))
        return false
      }
    },
    [remove]
  )

  return { tables, isLoading, loadError, reload, createTable, updateTable, moveTable, deleteTable }
}
