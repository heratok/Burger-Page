import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient, type DeletedRestaurantRecord } from "@/core/api/apiClient"
import { useAuth } from "@/context/slices/AuthContext"
import { keys, keyPrefixes } from "@/core/query/keys"

/** Soft-deleted restaurants shown in the directory's restore tab. */
export function useDeletedRestaurantsQuery() {
  const { session } = useAuth()
  return useQuery({
    queryKey: keys.deletedRestaurants(session.role),
    queryFn: async (): Promise<DeletedRestaurantRecord[]> => (await apiClient.listDeletedRestaurants()) || [],
    retry: false,
  })
}

/**
 * Revalidates the deleted list and the platform directory: a delete or a
 * restore moves a restaurant from one to the other.
 */
export function useInvalidateRestaurantLists() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.deletedRestaurants(session.role) }),
        queryClient.invalidateQueries({ queryKey: keys.restaurants(session.role) }),
        // A restored restaurant counts in the platform totals again.
        queryClient.invalidateQueries({ queryKey: keyPrefixes.platformStats() }),
      ]),
    [queryClient, session.role]
  )
}

export function useRestoreRestaurantMutation() {
  const invalidate = useInvalidateRestaurantLists()
  return useMutation({
    mutationFn: ({ id, slug }: { id: string; slug?: string }) =>
      apiClient.restoreRestaurant(id, slug ? { slug } : {}),
    onSuccess: () => {
      void invalidate()
    },
  })
}
