import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"
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
 * Server-backed list of the restaurant tables. Every change goes to the API
 * first (the server owns names and order); the list is only updated from what
 * it answers, except for reordering, which is optimistic and rolls back.
 */
export function useRestaurantTables(restaurantId: string | undefined): UseRestaurantTables {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(restaurantId && apiClient.hasToken()))
  const [loadError, setLoadError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    // Tables are staff data: without a session there is nothing to load.
    if (!restaurantId || !apiClient.hasToken()) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      setTables(await apiClient.fetchTables(restaurantId))
      setLoadError(null)
    } catch (err) {
      setTables([])
      setLoadError(errorMessage(err, "No se pudieron cargar las mesas"))
    } finally {
      setIsLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const createTable = useCallback(
    async (name: string) => {
      try {
        const created = await apiClient.createTable(name, restaurantId)
        setTables((prev) => [...prev, created])
        return created
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo crear la mesa"))
        return null
      }
    },
    [restaurantId]
  )

  const updateTable = useCallback(
    async (id: string, data: { name?: string; isActive?: boolean }) => {
      try {
        const updated = await apiClient.updateTable(id, data, restaurantId)
        setTables((prev) => prev.map((t) => (t.id === id ? updated : t)))
        return true
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo actualizar la mesa"))
        return false
      }
    },
    [restaurantId]
  )

  const moveTable = useCallback(
    async (id: string, direction: "up" | "down") => {
      const index = tables.findIndex((t) => t.id === id)
      const target = direction === "up" ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= tables.length) return

      const previous = tables
      const next = [...tables]
      ;[next[index], next[target]] = [next[target], next[index]]
      setTables(next)
      try {
        setTables(await apiClient.reorderTables(next.map((t) => t.id), restaurantId))
      } catch (err) {
        setTables(previous)
        toast.error(errorMessage(err, "No se pudo reordenar las mesas"))
      }
    },
    [tables, restaurantId]
  )

  const deleteTable = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteTable(id, restaurantId)
        setTables((prev) => prev.filter((t) => t.id !== id))
        return true
      } catch (err) {
        toast.error(errorMessage(err, "No se pudo eliminar la mesa"))
        return false
      }
    },
    [restaurantId]
  )

  return { tables, isLoading, loadError, reload, createTable, updateTable, moveTable, deleteTable }
}
