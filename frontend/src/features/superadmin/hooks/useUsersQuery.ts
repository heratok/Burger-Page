import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient, type ApiUserRecord } from "@/core/api/apiClient"
import { useAuth } from "@/context/slices/AuthContext"
import { keys } from "@/core/query/keys"

type UserList = ApiUserRecord[]

/**
 * Platform users, optionally scoped to one restaurant. Every list (global
 * directory and per-restaurant admins) lives under keys.users(role), so one
 * invalidation refreshes them all.
 */
export function useUsersQuery(restaurantId?: string, options: { enabled?: boolean } = {}) {
  const { session } = useAuth()
  return useQuery({
    queryKey: keys.users(session.role, restaurantId),
    queryFn: async (): Promise<UserList> => (await apiClient.listUsers(restaurantId)) || [],
    retry: false,
    enabled: options.enabled,
  })
}

/** Marks every cached user list stale and refetches the mounted ones. */
export function useInvalidateUsers() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: keys.users(session.role) }),
    [queryClient, session.role]
  )
}

/** Applies a confirmed write to every cached user list, then revalidates them. */
function useUsersWriteSettler() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const invalidate = useInvalidateUsers()
  return useCallback(
    (patch?: (list: UserList) => UserList) => {
      if (patch) {
        queryClient.setQueriesData<UserList>({ queryKey: keys.users(session.role) }, (list) =>
          list ? patch(list) : list
        )
      }
      void invalidate()
    },
    [queryClient, session.role, invalidate]
  )
}

export function useSetUserActiveMutation() {
  const settle = useUsersWriteSettler()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.setUserActive(id, isActive),
    onSuccess: (updated, { id }) =>
      settle((list) => list.map((u) => (u.id === id ? { ...u, isActive: updated.isActive } : u))),
  })
}

export function useDeleteUserMutation() {
  const settle = useUsersWriteSettler()
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteUser(id),
    onSuccess: (_result, id) => settle((list) => list.filter((u) => u.id !== id)),
  })
}

export function useResetUserPasswordMutation() {
  const settle = useUsersWriteSettler()
  return useMutation({
    mutationFn: (id: string) => apiClient.resetUserPassword(id),
    onSuccess: () => settle(),
  })
}
