import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { Outlet } from "react-router"
import { CircleAlert, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { storage } from "@/lib/storage"
import type { RestaurantRepository } from "@/lib/repository"
import { sessionMatches, useAdmin } from "@/store/admin-context"

interface AdminGateProps {
  /** Target restaurant; defaults to the first restaurant (legacy /admin route). */
  restaurantId?: string
  repo?: RestaurantRepository
  children?: ReactNode
}

/**
 * Mode-aware restaurant gate (design D4, spec AD-1): prompts for the TARGET
 * restaurant's adminPassword and, on success, opens a restaurant-mode session
 * scoped to that restaurant. Wrong passwords produce an error and no grant; a
 * session for any other restaurant (or super mode) never grants this gate.
 * Plain-text password is a documented MVP deferral of real auth.
 */
export default function AdminGate({ restaurantId, repo = storage, children }: AdminGateProps) {
  const { session, login } = useAdmin()
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  const targetId = restaurantId ?? storage.listRestaurants()[0]?.id

  if (targetId !== undefined && sessionMatches(session, "restaurant", targetId)) {
    return children ?? <Outlet />
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (targetId !== undefined && password === repo.getConfig().adminPassword) {
      login("restaurant", targetId)
    } else {
      setError(true)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Panel de administración
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Ingresa la contraseña de administrador para continuar.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full rounded-lg border border-border-subtle bg-card p-5"
      >
        <Field>
          <FieldLabel htmlFor="admin-password">Contraseña</FieldLabel>
          <FieldContent>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) setError(false)
              }}
              aria-invalid={error}
            />
            {error && (
              <FieldError role="alert" className="flex items-start gap-1.5">
                <CircleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Contraseña incorrecta. Intenta de nuevo.
              </FieldError>
            )}
          </FieldContent>
        </Field>
        <Button type="submit" className="mt-4 w-full">
          Ingresar
        </Button>
      </form>
    </div>
  )
}