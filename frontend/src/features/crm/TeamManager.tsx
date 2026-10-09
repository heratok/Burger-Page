import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import type { ApiUserRecord } from "@/core/api/apiClient"
import type { RoleDTO } from "@burger-page/contracts"
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  KeyRound,
  X,
  Copy,
  Check,
  Shield,
  UserCheck,
  UserX,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { toast } from "sonner"

function generateRandomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let part = ""
  for (let i = 0; i < 6; i++) {
    part += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Staff!${part}`
}

export const TeamManager: React.FC = () => {
  const { adminTheme, effectiveRestaurantId, session, setAdminTab } = useRestaurant()
  const isDark = adminTheme === "dark"

  const [users, setUsers] = useState<ApiUserRecord[]>([])
  const [roles, setRoles] = useState<RoleDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createRoleId, setCreateRoleId] = useState("")
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Edit Modal
  const [editingUser, setEditingUser] = useState<ApiUserRecord | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editRoleId, setEditRoleId] = useState("")
  const [editIsActive, setEditIsActive] = useState(true)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Credentials Reveal Modal
  const [credentialsReveal, setCredentialsReveal] = useState<{
    username: string
    password: string
  } | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  // Reset Password State
  const [resetTargetUser, setResetTargetUser] = useState<ApiUserRecord | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [newTempPasswordModal, setNewTempPasswordModal] = useState<{
    username: string
    temporaryPassword: string
  } | null>(null)
  const [hasCopiedReset, setHasCopiedReset] = useState(false)

  // Delete State
  const [userToDelete, setUserToDelete] = useState<ApiUserRecord | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [usersData, rolesData] = await Promise.all([
        apiClient.listUsers(effectiveRestaurantId),
        apiClient.listRoles(effectiveRestaurantId),
      ])
      setUsers(usersData)
      setRoles(rolesData)
    } catch (err: any) {
      toast.error(err.message || "Error al cargar el equipo de trabajo")
    } finally {
      setIsLoading(false)
    }
  }, [effectiveRestaurantId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const rolesMap = useMemo(() => {
    const map = new Map<string, RoleDTO>()
    roles.forEach((r) => map.set(r.id, r))
    return map
  }, [roles])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return users.filter((u) => {
      const matchSearch = u.username.toLowerCase().includes(term)
      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && u.role === "restaurant_admin") ||
        u.roleId === roleFilter
      return matchSearch && matchRole
    })
  }, [users, searchTerm, roleFilter])

  const openCreateModal = () => {
    setCreateUsername("")
    setCreatePassword(generateRandomPassword())
    setCreateRoleId(roles[0]?.id || "")
    setIsCreateOpen(true)
  }

  const openEditModal = (user: ApiUserRecord) => {
    setEditingUser(user)
    setEditUsername(user.username)
    setEditRoleId(user.roleId || "")
    setEditIsActive(user.isActive !== false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUser = createUsername.trim()
    if (!trimmedUser) {
      toast.error("El nombre de usuario es obligatorio")
      return
    }

    setIsSubmittingCreate(true)
    try {
      await apiClient.createUser({
        username: trimmedUser,
        password: createPassword,
        role: "restaurant_staff",
        roleId: createRoleId || undefined,
        restaurantId: effectiveRestaurantId,
      })
      toast.success("Usuario creado exitosamente")
      setIsCreateOpen(false)
      setCredentialsReveal({
        username: trimmedUser,
        password: createPassword,
      })
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || "Error al crear usuario")
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    const trimmedUser = editUsername.trim()
    if (!trimmedUser) {
      toast.error("El nombre de usuario es obligatorio")
      return
    }

    setIsSubmittingEdit(true)
    try {
      await apiClient.updateUser(editingUser.id, {
        username: trimmedUser,
        roleId: editRoleId || undefined,
        isActive: editIsActive,
      })
      toast.success("Usuario actualizado exitosamente")
      setEditingUser(null)
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar usuario")
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleConfirmReset = async () => {
    if (!resetTargetUser) return
    setIsResetting(true)
    try {
      const res = await apiClient.resetUserPassword(resetTargetUser.id)
      setNewTempPasswordModal({
        username: resetTargetUser.username,
        temporaryPassword: res.temporaryPassword,
      })
      setResetTargetUser(null)
      toast.success("Contraseña restablecida exitosamente")
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || "Error al restablecer contraseña")
    } finally {
      setIsResetting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    try {
      await apiClient.deleteUser(userToDelete.id)
      toast.success("Usuario eliminado exitosamente")
      setUserToDelete(null)
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar usuario")
    }
  }

  const handleCopyCredentials = (text: string, isReset = false) => {
    navigator.clipboard.writeText(text).then(() => {
      if (isReset) {
        setHasCopiedReset(true)
        setTimeout(() => setHasCopiedReset(false), 2000)
      } else {
        setHasCopied(true)
        setTimeout(() => setHasCopied(false), 2000)
      }
      toast.success("Copiado al portapapeles")
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="size-6 text-indigo-500" />
            <span>Gestión de Equipo</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Administra los usuarios de tu personal, asigna roles de acceso y genera credenciales seguras.
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          <span>Nuevo Miembro</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div
        className={`flex flex-col sm:flex-row items-center gap-3 rounded-2xl border p-3.5 shadow-xs ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            maxLength={60}
            placeholder="Buscar por nombre de usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administrador General</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div
          className={`h-64 rounded-2xl border animate-pulse ${
            isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"
          }`}
        />
      ) : filteredUsers.length === 0 ? (
        <div
          className={`rounded-2xl border p-12 text-center shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <Users className="size-12 mx-auto mb-3 text-slate-400 opacity-50" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {searchTerm ? "No se encontraron miembros coincidentes" : "No hay miembros registrados"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? "Prueba buscando con otro término."
              : "Registra a tus cocineros, cajeros y personal de salón para darles acceso controlado."}
          </p>
          {!searchTerm && (
            <Button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              <span>Registrar Miembro</span>
            </Button>
          )}
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  isDark
                    ? "border-slate-800 bg-slate-900/50 text-slate-400"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol Asignado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Seguridad</th>
                  <th className="px-4 py-3">Fecha de Alta</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isAdmin = user.role === "restaurant_admin"
                  const roleName = isAdmin
                    ? "Administrador"
                    : (user.roleId && rolesMap.get(user.roleId)?.name) || "Sin rol"
                  const isCurrent = user.username === session.username
                  const isActive = user.isActive !== false

                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors ${
                        isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Username */}
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 items-center justify-center rounded-full bg-indigo-500/10 font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{user.username}</span>
                              {isCurrent && (
                                <span className="rounded bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Shield className="size-3.5 text-indigo-500" />
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              isAdmin
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            }`}
                          >
                            {roleName}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <UserCheck className="size-3" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <UserX className="size-3" />
                            <span>Inactivo</span>
                          </span>
                        )}
                      </td>

                      {/* Security */}
                      <td className="px-4 py-3">
                        {user.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-3" />
                            <span>Requiere cambio</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Clave configurada</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("es-CO")
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setResetTargetUser(user)}
                            aria-label={`Restablecer clave ${user.username}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 transition-colors"
                            title="Restablecer contraseña"
                          >
                            <KeyRound className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            aria-label={`Editar usuario ${user.username}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Editar usuario"
                          >
                            <Pencil className="size-4" />
                          </button>
                          {!isAdmin && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              aria-label={`Eliminar usuario ${user.username}`}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className="size-4 text-indigo-500" />
                <span>Registrar Nuevo Miembro</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="create-username-input"
                  className="block font-semibold mb-1 text-slate-700 dark:text-slate-200"
                >
                  Nombre de Usuario *
                </label>
                <input
                  id="create-username-input"
                  type="text"
                  required
                  maxLength={40}
                  placeholder="ej. camilo_caja, laura_cocina"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="create-password-input"
                    className="font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Clave Temporal *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreatePassword(generateRandomPassword())}
                    className="text-[11px] font-semibold text-indigo-500 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="size-3" />
                    <span>Regenerar</span>
                  </button>
                </div>
                <input
                  id="create-password-input"
                  type="text"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className={`w-full rounded-xl border p-2.5 font-mono text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="create-role-select"
                  className="block font-semibold mb-1 text-slate-700 dark:text-slate-200"
                >
                  Rol Asignado *
                </label>
                {roles.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">
                      No hay roles creados todavía. Para asignar permisos a tu personal, primero crea los roles recomendados.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateOpen(false)
                        setAdminTab("roles")
                      }}
                      className="mt-2 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
                    >
                      <span>Ir a configurar roles</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      id="create-role-select"
                      required
                      value={createRoleId}
                      onChange={(e) => setCreateRoleId(e.target.value)}
                      className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      <option value="" disabled>
                        Selecciona un rol...
                      </option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.description ? ` — ${r.description}` : ` (${r.permissions.length} permisos)`}
                        </option>
                      ))}
                    </select>
                    {rolesMap.get(createRoleId)?.description && (
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {rolesMap.get(createRoleId)?.description}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300">
                El empleado deberá cambiar esta contraseña temporal obligatoriamente en su primer inicio de sesión.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmittingCreate}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingCreate || roles.length === 0}
                  className="bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700"
                >
                  {isSubmittingCreate ? "Creando..." : "Crear Usuario"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Pencil className="size-4 text-indigo-500" />
                <span>Editar Miembro del Equipo</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="edit-username-input"
                  className="block font-semibold mb-1 text-slate-700 dark:text-slate-200"
                >
                  Nombre de Usuario *
                </label>
                <input
                  id="edit-username-input"
                  type="text"
                  required
                  maxLength={40}
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              {editingUser.role !== "restaurant_admin" && (
                <div>
                  <label
                    htmlFor="edit-role-select"
                    className="block font-semibold mb-1 text-slate-700 dark:text-slate-200"
                  >
                    Rol Asignado *
                  </label>
                  {roles.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-medium">
                        No hay roles creados todavía. Para asignar permisos a tu personal, primero crea los roles recomendados.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(null)
                          setAdminTab("roles")
                        }}
                        className="mt-2 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
                      >
                        <span>Ir a configurar roles</span>
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        id="edit-role-select"
                        required
                        value={editRoleId}
                        onChange={(e) => setEditRoleId(e.target.value)}
                        className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isDark
                            ? "border-slate-700 bg-slate-800 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                      >
                        <option value="" disabled>
                          Selecciona un rol...
                        </option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}{r.description ? ` — ${r.description}` : ` (${r.permissions.length} permisos)`}
                          </option>
                        ))}
                      </select>
                      {rolesMap.get(editRoleId)?.description && (
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {rolesMap.get(editRoleId)?.description}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="edit-active-toggle"
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="edit-active-toggle"
                  className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Usuario activo (puede iniciar sesión)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmittingEdit ||
                    (editingUser.role !== "restaurant_admin" && roles.length === 0)
                  }
                  className="bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700"
                >
                  {isSubmittingEdit ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Reveal Modal */}
      {credentialsReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="size-5" />
                <span>Credenciales de Acceso</span>
              </h3>
              <button
                type="button"
                onClick={() => setCredentialsReveal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Copia las credenciales a continuación para enviarlas al empleado por WhatsApp o en persona:
            </p>

            <div
              className={`rounded-xl border p-4 space-y-2.5 font-mono text-xs ${
                isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Usuario</span>
                <div className="font-bold text-slate-900 dark:text-white select-all">
                  {credentialsReveal.username}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Clave Temporal</span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 select-all">
                  {credentialsReveal.password}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                onClick={() =>
                  handleCopyCredentials(
                    `Usuario: ${credentialsReveal.username}\nClave: ${credentialsReveal.password}`
                  )
                }
                className="flex-1 bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                {hasCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{hasCopied ? "¡Copiado!" : "Copiar Credenciales"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCredentialsReveal(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Result Modal */}
      {newTempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-indigo-500">
                <KeyRound className="size-5" />
                <span>Nueva Clave Temporal</span>
              </h3>
              <button
                type="button"
                onClick={() => setNewTempPasswordModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              Se ha generado una nueva contraseña temporal para el usuario{" "}
              <strong>{newTempPasswordModal.username}</strong>:
            </p>

            <div
              className={`rounded-xl border p-4 text-center font-mono text-sm font-bold select-all ${
                isDark
                  ? "border-slate-800 bg-slate-900 text-emerald-400"
                  : "border-slate-200 bg-slate-50 text-emerald-600"
              }`}
            >
              {newTempPasswordModal.temporaryPassword}
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                onClick={() =>
                  handleCopyCredentials(newTempPasswordModal.temporaryPassword, true)
                }
                className="flex-1 bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                {hasCopiedReset ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{hasCopiedReset ? "¡Copiado!" : "Copiar Clave"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewTempPasswordModal(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Dialog */}
      <ConfirmDeleteModal
        isOpen={resetTargetUser !== null}
        onClose={() => setResetTargetUser(null)}
        onConfirm={handleConfirmReset}
        title="¿Restablecer contraseña?"
        targetName={resetTargetUser?.username}
        confirmText={isResetting ? "Restableciendo..." : "Restablecer clave"}
        description={
          resetTargetUser
            ? `¿Deseas generar una nueva contraseña temporal para "${resetTargetUser.username}"? La clave anterior dejará de ser válida.`
            : undefined
        }
      />

      {/* Delete User Confirmation Dialog */}
      <ConfirmDeleteModal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar usuario?"
        targetName={userToDelete?.username}
        confirmText="Eliminar definitivamente"
        description={
          userToDelete
            ? `¿Estás seguro de que deseas eliminar permanentemente a "${userToDelete.username}" del equipo? Esta acción no se puede deshacer.`
            : undefined
        }
      />
    </div>
  )
}
