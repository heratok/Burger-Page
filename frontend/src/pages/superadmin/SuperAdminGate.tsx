import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { Outlet } from "react-router"
import { CircleAlert, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { storage } from "@/lib/storage"
import type { DirectoryRepository } from "@/lib/repository"
import { sessionMatches, useAdmin } from "@/store/admin-context"

interface SuperAdminGateProps {
  directory?: DirectoryRepository
  children?: ReactNode
}

/**
 * Super-admin gate (design D4, spec SA-1): /admin authenticates against the
 * envelope's superAdminPassword (seed "superadmin") and, on success, opens a
 * super-mode session. Restaurant-mode sessions never open the super portal;
 * the gate stays super-only.
 */
export default function SuperAdminGate({
  directory = storage,
  children,
}: SuperAdminGateProps) {
  const { session, login } = useAdmin()
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  if (sessionMatches(session, "super")) {
    return children ?? <Outlet />
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (password === directory.getSuperAdminPassword()) {
      login("super")
    } else {
      setError(true)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Portal de administración
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Ingresa la contraseña de super administrador para gestionar los
            restaurantes.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full rounded-lg border border-border-subtle bg-card p-5"
      >
        <Field>
          <FieldLabel htmlFor="super-password">Contraseña de super administrador</FieldLabel>
          <FieldContent>
            <Input
              id="super-password"
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