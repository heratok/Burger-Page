import { useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
import { useAuth } from "@/context/slices/AuthContext"
import { keys } from "@/core/query/keys"
import type { RestaurantTable } from "@/types/restaurant"
import { sameZone } from "./tableZones"

export interface NewTableInput {
  zone: string
  number: number
  alias?: string
}
export interface TableChanges {
  zone?: string
  number?: number
  /** A string sets the alias, null clears it. */
  alias?: string | null
  isActive?: boolean
}
export interface BulkTablesInput {
  zone: string
  from: number
  to: number
}
export interface BulkTablesResult {
  created: RestaurantTable[]
  skipped: number[]
}

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback

export interface UseRestaurantTables {
  tables: RestaurantTable[]
  isLoading: boolean
  loadError: string | null
  reload: () => Promise<void>
  /** Resolves the created table, or null (after an error toast) when rejected. */
  createTable: (data: NewTableInput) => Promise<RestaurantTable | null>
  /** Creates zone numbers from..to. Resolves null (after an error toast) when rejected. */
  createTablesBulk: (data: BulkTablesInput) => Promise<BulkTablesResult | null>
  updateTable: (id: string, data: TableChanges) => Promise<boolean>
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
    mutationFn: (data: NewTableInput) => apiClient.createTable(data, restaurantId),
    onSuccess: (created) => commit((list) => [...list, created]),
  })
  const { mutateAsync: createBulk } = useMutation({
    mutationFn: (data: BulkTablesInput) => apiClient.createTablesBulk(data, restaurantId),
    onSuccess: ({ created }) => commit((list) => [...list, ...created]),
  })
  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TableChanges }) =>
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
    async (data: NewTableInput) => {
      try {
        return await create(data)
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo crear la mesa"))
        return null
      }
    },
    [create]
  )

  const createTablesBulk = useCallback(
    async (data: BulkTablesInput) => {
      try {
        const result = await createBulk(data)
        if (result.skipped.length > 0) {
          toast.info(
            `Se crearon ${result.created.length} mesas. Se omitieron ${result.skipped.length} que ya existían: ${result.skipped.join(", ")}.`
          )
        }
        return result
      } catch (err) {
        toast.error(errorMessage(err, "No se pudieron crear las mesas"))
        return null
      }
    },
    [createBulk]
  )

  const updateTable = useCallback(
    async (id: string, data: TableChanges) => {
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
      if (index < 0) return
      // The list is shown grouped by zone: swap with the neighbor of the same zone.
      const step = direction === "up" ? -1 : 1
      let target = index + step
      while (target >= 0 && target < tables.length && !sameZone(tables[target].zone, tables[index].zone)) {
        target += step
      }
      if (target < 0 || target >= tables.length) return

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

  return { tables, isLoading, loadError, reload, createTable, createTablesBulk, updateTable, moveTable, deleteTable }
}
