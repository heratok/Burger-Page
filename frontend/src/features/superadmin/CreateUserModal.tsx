import React, { useState } from "react"
import { useRestaurant } from "@/context/RestaurantContext"
import { UserPlus, X, Shield, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose }) => {
  const { restaurants, adminTheme } = useRestaurant()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"super_admin" | "restaurant_admin">("restaurant_admin")
  const [restaurantId, setRestaurantId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const isDark = adminTheme === "dark"

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    if (role === "restaurant_admin" && !restaurantId) return

    setIsLoading(true)
    try {
      const user = await apiClient.createUser({
        username: username.trim(),
        password: password.trim(),
        role,
        restaurantId: role === "restaurant_admin" ? restaurantId : undefined,
      })
      toast.success(`Usuario "${user.username}" creado exitosamente`)
      setUsername("")
      setPassword("")
      setRole("restaurant_admin")
      setRestaurantId("")
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al crear usuario"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = `w-full rounded-xl border px-3.5 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark
      ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400"
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? "border-slate-800 bg-[#0E1322] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Crear Usuario</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Asigna credenciales de acceso al panel de un restaurante.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
              Nombre de Usuario *
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin_rosto"
              className={inputClass}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
              Contraseña * (mínimo 6 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña segura"
              className={inputClass}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
              Rol del Usuario
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "restaurant_admin" as const, icon: Store, name: "Admin Restaurante", desc: "Gestiona un local" },
                { id: "super_admin" as const, icon: Shield, name: "Super Admin", desc: "Acceso total a la plataforma" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id)
                    if (r.id === "super_admin") setRestaurantId("")
                  }}
                  className={`rounded-xl border p-3 text-left transition-all flex items-start gap-2 ${
                    role === r.id
                      ? "border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500"
                      : isDark
                      ? "border-slate-800 bg-slate-900 hover:border-slate-700"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <r.icon className={`size-4 mt-0.5 ${
                    role === r.id ? "text-indigo-500" : "text-slate-400"
                  }`} />
                  <div>
                    <div className="text-xs font-bold">{r.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Restaurant selector (only for restaurant_admin) */}
          {role === "restaurant_admin" && (
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                Restaurante Asignado *
              </label>
              <select
                required
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccionar restaurante...</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.config.name} (/{r.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2.5 border-t pt-4 border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2 rounded-xl bg-violet-600 font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-700"
            >
              <UserPlus className="size-4" />
              <span>{isLoading ? "Creando..." : "Crear Usuario"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
