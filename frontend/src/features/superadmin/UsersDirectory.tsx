import React, { useState, useEffect, useMemo } from "react"
import { useUi, useAuth, useTenant } from "@/context/RestaurantContext"
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Store,
  Calendar,
  Filter,
  KeyRound,
  Trash2,
  Power,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { TableSkeleton } from "@/components/ui/Skeletons"
import { CreateUserModal } from "./CreateUserModal"
import { EditUserModal } from "./EditUserModal"
import { ResetPasswordModal } from "./ResetPasswordModal"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import type { ApiUserRecord } from "@/core/api/apiClient"
import { toast } from "sonner"
import { mapUserActionError } from "./userActionUtils"
import {
  useUsersQuery,
  useInvalidateUsers,
  useSetUserActiveMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
} from "./hooks/useUsersQuery"


function parseJwtPayload(token?: string): { userId?: string; username?: string; role?: string } | null {
  if (!token) return null
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export const UsersDirectory: React.FC = () => {
  const { adminTheme } = useUi()
  const { session } = useAuth()
  const { restaurants } = useTenant()
  const usersQuery = useUsersQuery()
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const isLoading = usersQuery.isLoading
  const reloadUsers = useInvalidateUsers()
  const { mutateAsync: setUserActive } = useSetUserActiveMutation()
  const { mutateAsync: deleteUser } = useDeleteUserMutation()
  const { mutateAsync: resetUserPassword } = useResetUserPasswordMutation()
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("ALL")
  const [restaurantFilter, setRestaurantFilter] = useState<string>("ALL")
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [resetModalData, setResetModalData] = useState<{ username: string; temporaryPassword?: string } | null>(null)
  const [userToDelete, setUserToDelete] = useState<ApiUserRecord | null>(null)
  const [userToEdit, setUserToEdit] = useState<ApiUserRecord | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const isDark = adminTheme === "dark"

  // One toast per failed read (errorUpdatedAt changes on every failure).
  const { error: loadError, errorUpdatedAt } = usersQuery
  useEffect(() => {
    if (!loadError) return
    toast.error(mapUserActionError(loadError, "No se pudo cargar la lista de usuarios"))
  }, [loadError, errorUpdatedAt])

  const restaurantMap = useMemo(() => {
    const map = new Map<string, string>()
    restaurants.forEach((r) => map.set(r.id, r.config.name))
    return map
  }, [restaurants])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.restaurantId && u.restaurantId.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchRole =
        roleFilter === "ALL" ||
        (roleFilter === "super_admin" && (u.role === "super_admin" || u.role === "super")) ||
        (roleFilter === "restaurant_admin" && (u.role === "restaurant_admin" || u.role === "restaurant"))

      const matchRestaurant =
        restaurantFilter === "ALL" || u.restaurantId === restaurantFilter

      return matchSearch && matchRole && matchRestaurant
    })
  }, [users, searchTerm, roleFilter, restaurantFilter])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/D"
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const handleToggleActive = async (u: ApiUserRecord) => {
    const nextActive = u.isActive === false
    setActionLoadingId(u.id)
    try {
      await setUserActive({ id: u.id, isActive: nextActive })
      toast.success(
        nextActive
          ? `Usuario "${u.username}" activado con éxito`
          : `Usuario "${u.username}" desactivado con éxito`
      )
    } catch (err: any) {
      toast.error(
        mapUserActionError(
          err,
          nextActive ? "No se pudo activar el usuario" : "No se pudo desactivar el usuario"
        )
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleResetPassword = async (u: ApiUserRecord) => {
    setActionLoadingId(u.id)
    try {
      const res = await resetUserPassword(u.id)
      setResetModalData({ username: u.username, temporaryPassword: res.temporaryPassword })
      toast.success(`Contraseña de "${u.username}" restablecida correctamente`)
    } catch (err: any) {
      toast.error(mapUserActionError(err, "No se pudo restablecer la contraseña del usuario"))
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    const target = userToDelete
    setUserToDelete(null)
    setActionLoadingId(target.id)
    try {
      await deleteUser(target.id)
      toast.success(`Usuario "${target.username}" eliminado con éxito`)
    } catch (err: any) {
      toast.error(mapUserActionError(err, "No se pudo eliminar el usuario"))
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Shield className="size-3.5" />
            <span>Gestión de Accesos & Seguridad</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-slate-900 dark:text-white">
            Directorio Global de Usuarios
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Control de credenciales, roles y asignaciones de restaurantes para administradores.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateUserOpen(true)}
          className="gap-2 rounded-xl bg-violet-600 font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-700 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="size-4" />
          <span>+ Nuevo Usuario</span>
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`rounded-2xl border p-4 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Usuarios</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{users.length}</div>
          <span className="text-[11px] text-slate-400">Credenciales registradas</span>
        </div>

        <div className={`rounded-2xl border p-4 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Super Admins</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Shield className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">
            {users.filter((u) => u.role === "super_admin" || u.role === "super").length}
          </div>
          <span className="text-[11px] text-slate-400">Acceso total a la plataforma</span>
        </div>

        <div className={`rounded-2xl border p-4 shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Admins Locales</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Store className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">
            {users.filter((u) => u.role === "restaurant_admin" || u.role === "restaurant").length}
          </div>
          <span className="text-[11px] text-slate-400">Encargados de locales</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={`flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            maxLength={50}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Buscar por nombre de usuario..."
            className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800/80 text-slate-100 placeholder-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-48">
            <Select
              size="md"
              leftIcon={<Filter className="size-3.5 text-slate-400" />}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={[
                { value: "ALL", label: "Todos los roles" },
                { value: "super_admin", label: "👑 Super Admins" },
                { value: "restaurant_admin", label: "🏪 Admins Locales" },
              ]}
            />
          </div>

          <div className="w-full sm:w-60">
            <Select
              size="md"
              leftIcon={<Store className="size-3.5 text-slate-400" />}
              value={restaurantFilter}
              onChange={(e) => {
                setRestaurantFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={[
                { value: "ALL", label: "Todos los restaurantes" },
                ...restaurants.map((r) => ({
                  value: r.id,
                  label: r.config.name,
                })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <TableSkeleton isDark={isDark} rows={5} columns={6} />
      ) : (
        <div className={`overflow-hidden rounded-2xl border shadow-xs ${isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-slate-800 bg-slate-900/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-500"}`}>
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Restaurante Asignado</th>
                  <th className="px-4 py-3">Fecha de Registro</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-slate-800/60 text-slate-200" : "divide-slate-100 text-slate-700"}`}>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Users className="size-8 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold">No se encontraron usuarios coincidentes</p>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isSuperAdmin = u.role === "super_admin" || u.role === "super"
                    const assignedName = u.restaurantId ? restaurantMap.get(u.restaurantId) || u.restaurantId : null
                    const isActive = u.isActive !== false
                    const token = (session as { token?: string }).token || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("burger_page_auth_token_v2") : null)
                    const tokenPayload = parseJwtPayload(token || undefined)
                    const sessionUserId = session.userId || tokenPayload?.userId
                    const sessionUsername = session.username || tokenPayload?.username

                    const isSelf = Boolean(
                      (sessionUserId && sessionUserId === u.id) ||
                      (sessionUsername && sessionUsername.toLowerCase() === u.username.toLowerCase()) ||
                      (!sessionUserId &&
                        !sessionUsername &&
                        ((session.role as string) === "super" || (session.role as string) === "super_admin") &&
                        isSuperAdmin &&
                        (u.username.toLowerCase() === "admin" ||
                          users.filter((x) => x.role === "super_admin" || x.role === "super").length === 1))
                    )
                    const isBusy = actionLoadingId === u.id

                    return (
                      <tr key={u.id} className={`transition-colors ${isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/80"}`}>
                        <td className="px-4 py-3 font-semibold">
                          <div className="flex items-center gap-2.5">
                            <div className={`flex size-8 items-center justify-center rounded-xl font-bold text-xs ${
                              isSuperAdmin
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                : "bg-indigo-500/15 text-indigo-500 border border-indigo-500/30"
                            }`}>
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">{u.username}</span>
                                {isSelf && (
                                  <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-500 border border-indigo-500/20">
                                    Tú
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Shield className="size-3" />
                              <span>Super Admin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                              <Store className="size-3" />
                              <span>Admin Local</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {isSuperAdmin ? (
                            <span className="text-slate-400 italic">Acceso Global (Todos los locales)</span>
                          ) : assignedName ? (
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                              <Store className="size-3.5 text-indigo-500" />
                              <span>{assignedName}</span>
                            </div>
                          ) : (
                            <span className="text-rose-400 font-semibold">Sin local vinculado</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3 text-slate-400" />
                            <span>{formatDate(u.createdAt)}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Activo</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              <span>Inactivo</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit user */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => setUserToEdit(u)}
                              title="Editar usuario"
                              aria-label={`Editar usuario ${u.username}`}
                              className="h-7 px-2.5 text-xs font-semibold rounded-lg text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer"
                            >
                              <Pencil className="size-3 mr-1" />
                              <span>Editar</span>
                            </Button>

                            {/* Toggle active / inactive */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSelf || isBusy}
                              onClick={() => handleToggleActive(u)}
                              title={
                                isSelf
                                  ? "No puedes desactivar tu propia cuenta"
                                  : isActive
                                  ? "Desactivar usuario"
                                  : "Activar usuario"
                              }
                              aria-label={isActive ? "Desactivar" : "Activar"}
                              className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${
                                isActive
                                  ? "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                  : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                            >
                              <Power className="size-3 mr-1" />
                              <span>{isActive ? "Desactivar" : "Activar"}</span>
                            </Button>

                            {/* Reset password */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSelf || isBusy}
                              onClick={() => handleResetPassword(u)}
                              title={isSelf ? "Usa 'Cambiar clave' para tu propia cuenta" : "Restablecer contraseña"}
                              aria-label="Restablecer clave"
                              className="h-7 px-2.5 text-xs font-semibold rounded-lg text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <KeyRound className="size-3 mr-1" />
                              <span>Restablecer clave</span>
                            </Button>

                            {/* Delete user */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSelf || isBusy}
                              onClick={() => setUserToDelete(u)}
                              title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                              aria-label="Eliminar usuario"
                              className="h-7 size-7 p-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            className="border-t border-slate-100 dark:border-slate-800"
          />
        </div>
      )}

      {/* Creation Modal */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => {
          setIsCreateUserOpen(false)
          void reloadUsers()
        }}
      />

      {/* Reset Password Modal */}
      {resetModalData && (
        <ResetPasswordModal
          isOpen={Boolean(resetModalData)}
          onClose={() => setResetModalData(null)}
          username={resetModalData.username}
          temporaryPassword={resetModalData.temporaryPassword}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar usuario?"
        targetName={userToDelete?.username}
        description={
          userToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente al usuario "${userToDelete.username}"? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmText="Eliminar definitivamente"
      />

      {/* Edit User Modal */}
      {userToEdit && (
        <EditUserModal
          isOpen={Boolean(userToEdit)}
          onClose={() => setUserToEdit(null)}
          user={userToEdit}
          onSuccess={() => void reloadUsers()}
        />
      )}
    </div>
  )
}
