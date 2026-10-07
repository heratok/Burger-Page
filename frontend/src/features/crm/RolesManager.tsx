import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import type { RoleDTO, Permission, RoleCreateInput } from "@burger-page/contracts"
import { PERMISSIONS } from "@burger-page/contracts"
import {
  ShieldCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Boxes,
  Layers,
  DollarSign,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal"
import { toast } from "sonner"

interface PermissionMeta {
  id: Permission
  label: string
  description: string
}

interface PermissionCategory {
  category: string
  icon: React.ComponentType<{ className?: string }>
  permissions: PermissionMeta[]
}

const PERMISSION_GROUPS: PermissionCategory[] = [
  {
    category: "Pedidos & Cocina",
    icon: ShoppingBag,
    permissions: [
      {
        id: "orders.view",
        label: "Ver pedidos",
        description: "Acceso al tablero Kanban y comandas de cocina",
      },
      {
        id: "orders.manage",
        label: "Gestionar pedidos",
        description: "Aceptar, preparar, cambiar estados y cobrar pedidos",
      },
      {
        id: "orders.delete",
        label: "Eliminar pedidos",
        description: "Anular o eliminar órdenes registradas",
      },
    ],
  },
  {
    category: "Clientes (CRM)",
    icon: Users,
    permissions: [
      {
        id: "customers.view",
        label: "Ver clientes",
        description: "Consultar lista de clientes registrados e historial",
      },
      {
        id: "customers.manage",
        label: "Gestionar clientes",
        description: "Editar datos de contacto, direcciones y notas de clientes",
      },
    ],
  },
  {
    category: "Menú & Catálogo",
    icon: UtensilsCrossed,
    permissions: [
      {
        id: "menu.manage",
        label: "Gestionar menú",
        description: "Crear y editar productos, categorías y modificadores",
      },
    ],
  },
  {
    category: "Inventario",
    icon: Boxes,
    permissions: [
      {
        id: "inventory.manage",
        label: "Gestionar inventario",
        description: "Control de stock, alertas de reposición y proveedores",
      },
    ],
  },
  {
    category: "Mesas & Salón",
    icon: Layers,
    permissions: [
      {
        id: "tables.manage",
        label: "Gestionar mesas",
        description: "Configurar distribución de salón y vincular pedidos a mesas",
      },
    ],
  },
  {
    category: "Finanzas & Reportes",
    icon: DollarSign,
    permissions: [
      {
        id: "finance.view",
        label: "Ver finanzas y reportes",
        description: "Visualizar ingresos, totales de ventas y cierre de caja",
      },
    ],
  },
  {
    category: "Equipo & Accesos",
    icon: Shield,
    permissions: [
      {
        id: "users.manage",
        label: "Gestionar equipo",
        description: "Crear usuarios de personal y restablecer contraseñas",
      },
      {
        id: "roles.manage",
        label: "Gestionar roles",
        description: "Crear y configurar roles y permisos de acceso",
      },
    ],
  },
  {
    category: "Configuración",
    icon: Settings,
    permissions: [
      {
        id: "settings.manage",
        label: "Gestionar configuración",
        description: "Ajustes del local, horarios, WhatsApp y personalizador",
      },
    ],
  },
]

const ROLE_PRESETS = [
  {
    name: "Cocina / Pedidos",
    description: "Flujo operativo de comandas",
    permissions: ["orders.view", "orders.manage"] as Permission[],
  },
  {
    name: "Cajero",
    description: "Atención en caja, cobros y clientes",
    permissions: [
      "orders.view",
      "orders.manage",
      "customers.view",
      "customers.manage",
      "tables.manage",
      "finance.view",
    ] as Permission[],
  },
  {
    name: "Administrador General",
    description: "Acceso total a todos los módulos",
    permissions: [...PERMISSIONS] as Permission[],
  },
]

export const RolesManager: React.FC = () => {
  const { adminTheme } = useRestaurant()
  const isDark = adminTheme === "dark"

  const [roles, setRoles] = useState<RoleDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleDTO | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete modal state
  const [roleToDelete, setRoleToDelete] = useState<RoleDTO | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.listRoles()
      setRoles(data)
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la lista de roles")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  const filteredRoles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return roles
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.description && r.description.toLowerCase().includes(term))
    )
  }, [roles, searchTerm])

  const openCreateModal = () => {
    setEditingRole(null)
    setFormName("")
    setFormDescription("")
    setSelectedPermissions(new Set(["orders.view", "orders.manage"]))
    setIsModalOpen(true)
  }

  const openEditModal = (role: RoleDTO) => {
    setEditingRole(role)
    setFormName(role.name)
    setFormDescription(role.description || "")
    setSelectedPermissions(new Set(role.permissions))
    setIsModalOpen(true)
  }

  const handleApplyPreset = (presetPerms: Permission[]) => {
    setSelectedPermissions(new Set(presetPerms))
  }

  const handleTogglePermission = (id: Permission) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleToggleCategory = (perms: PermissionMeta[]) => {
    const allSelected = perms.every((p) => selectedPermissions.has(p.id))
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        perms.forEach((p) => next.delete(p.id))
      } else {
        perms.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = formName.trim()
    if (!trimmedName) {
      toast.error("El nombre del rol es obligatorio")
      return
    }

    const payload: RoleCreateInput = {
      name: trimmedName,
      description: formDescription.trim() || undefined,
      permissions: Array.from(selectedPermissions),
    }

    setIsSubmitting(true)
    try {
      if (editingRole) {
        await apiClient.updateRole(editingRole.id, payload)
        toast.success("Rol actualizado exitosamente")
      } else {
        await apiClient.createRole(payload)
        toast.success("Rol creado exitosamente")
      }
      setIsModalOpen(false)
      await fetchRoles()
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el rol")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return
    setConflictError(null)
    try {
      await apiClient.deleteRole(roleToDelete.id)
      toast.success("Rol eliminado exitosamente")
      setRoleToDelete(null)
      await fetchRoles()
    } catch (err: any) {
      const status = err.status || err.statusCode
      if (status === 409 || err.message?.includes("assigned") || err.message?.includes("usuarios")) {
        const msg =
          "No se puede eliminar el rol porque tiene usuarios asignados. Reasigna los usuarios antes de eliminarlo."
        setConflictError(msg)
        toast.error(msg)
      } else {
        toast.error(err.message || "Error al eliminar el rol")
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="size-6 text-indigo-500" />
            <span>Roles y Permisos</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Administra los roles personalizados y los permisos de acceso para tu equipo de trabajo.
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          <span>Nuevo Rol</span>
        </Button>
      </div>

      {/* Conflict banner if deletion failed */}
      {conflictError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-center justify-between">
          <span>{conflictError}</span>
          <button
            type="button"
            onClick={() => setConflictError(null)}
            className="text-rose-600 hover:text-rose-900 dark:text-rose-400"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-xs ${
          isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
        }`}
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            maxLength={60}
            placeholder="Buscar rol por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-xl border pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark
                ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>
      </div>

      {/* Roles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-48 rounded-2xl border p-5 animate-pulse ${
                isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"
              }`}
            />
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <div
          className={`rounded-2xl border p-12 text-center shadow-xs ${
            isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
          }`}
        >
          <ShieldCheck className="size-12 mx-auto mb-3 text-slate-400 opacity-50" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {searchTerm ? "No se encontraron roles coincidentes" : "No hay roles configurados"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? "Prueba buscando con otro término."
              : "Comienza creando tu primer rol (ej. Cocinero, Cajero, Mozo) para delegar funciones a tu personal."}
          </p>
          {!searchTerm && (
            <Button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              <span>Crear Rol</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role) => {
            const permCount = role.permissions.length
            return (
              <div
                key={role.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md ${
                  isDark ? "border-slate-800 bg-[#0E1322]" : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {role.name}
                        </h3>
                        {role.isSystem && (
                          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500">
                            Sistema
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {role.description || <span className="italic">Sin descripción</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(role)}
                        aria-label={`Editar rol ${role.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                        title="Editar rol"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {!role.isSystem && (
                        <button
                          type="button"
                          onClick={() => {
                            setConflictError(null)
                            setRoleToDelete(role)
                          }}
                          aria-label={`Eliminar rol ${role.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                          title="Eliminar rol"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permissions count badge & preview */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        Permisos asignados
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                        {permCount} de {PERMISSIONS.length}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.slice(0, 4).map((p) => (
                        <span
                          key={p}
                          className="rounded-md border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                        >
                          {p}
                        </span>
                      ))}
                      {permCount > 4 && (
                        <span className="rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                          +{permCount - 4} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  Actualizado: {new Date(role.updatedAt).toLocaleDateString("es-CO")}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-[#0E1322] text-white" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
                <ShieldCheck className="size-5 text-indigo-500" />
                <span>{editingRole ? "Editar Rol" : "Crear Nuevo Rol"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 text-xs">
              {/* Basic Fields */}
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="role-name-input"
                    className="block font-bold mb-1 text-slate-800 dark:text-slate-200"
                  >
                    Nombre del Rol *
                  </label>
                  <input
                    id="role-name-input"
                    type="text"
                    required
                    maxLength={40}
                    placeholder="Ej. Cocinero de Parrilla, Cajero Turno Noche"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="role-description-input"
                    className="block font-bold mb-1 text-slate-800 dark:text-slate-200"
                  >
                    Descripción (Opcional)
                  </label>
                  <textarea
                    id="role-description-input"
                    rows={2}
                    maxLength={200}
                    placeholder="Describe las responsabilidades o funciones del rol..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={`w-full rounded-xl border p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-white placeholder-slate-400"
                        : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
              </div>

              {/* Presets Toolbar */}
              <div>
                <label className="block font-bold mb-1.5 text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Plantillas Rápidas (Presets)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset.permissions)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                        isDark
                          ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:border-indigo-500/50 hover:bg-slate-700"
                          : "border-slate-200 bg-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-slate-200"
                      }`}
                      title={preset.description}
                    >
                      <span>{preset.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(new Set())}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Grouped Permissions Checklist */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Permisos de Acceso ({selectedPermissions.size} de {PERMISSIONS.length})
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(new Set(PERMISSIONS))}
                      className="text-indigo-600 hover:underline dark:text-indigo-400 font-semibold"
                    >
                      Marcar todos
                    </button>
                    <span>&middot;</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(new Set())}
                      className="text-slate-500 hover:underline dark:text-slate-400"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {PERMISSION_GROUPS.map((group) => {
                    const GroupIcon = group.icon
                    const allInGroupSelected = group.permissions.every((p) =>
                      selectedPermissions.has(p.id)
                    )

                    return (
                      <div
                        key={group.category}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          isDark
                            ? "border-slate-800/80 bg-slate-900/40"
                            : "border-slate-200 bg-slate-50/70"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                            <GroupIcon className="size-4 text-indigo-500" />
                            <span>{group.category}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(group.permissions)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {allInGroupSelected ? "Quitar grupo" : "Seleccionar grupo"}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {group.permissions.map((perm) => {
                            const isChecked = selectedPermissions.has(perm.id)
                            return (
                              <label
                                key={perm.id}
                                htmlFor={`perm-${perm.id}`}
                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                  isChecked
                                    ? isDark
                                      ? "bg-indigo-500/10 text-white"
                                      : "bg-indigo-50 text-slate-900"
                                    : isDark
                                    ? "hover:bg-slate-800/50 text-slate-300"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <input
                                  id={`perm-${perm.id}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.id)}
                                  className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {perm.label}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {perm.description}
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700"
                >
                  {isSubmitting ? "Guardando..." : "Guardar Rol"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={roleToDelete !== null}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar rol?"
        targetName={roleToDelete?.name}
        confirmText="Eliminar rol"
        description={
          roleToDelete
            ? `¿Estás seguro de que deseas eliminar el rol "${roleToDelete.name}"? Esta acción no se puede deshacer.`
            : undefined
        }
      />
    </div>
  )
}
