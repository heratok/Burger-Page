import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CircleAlert, KeyRound } from "lucide-react"
import { Button } from "@/shared/ui/ui/button"
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/ui/field"
import { Input } from "@/shared/ui/ui/input"
import { storage } from "@/shared/storage/storage"
import type { DirectoryRepository } from "@/shared/storage/repository"

const passwordSchema = z
  .object({
    next: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
    confirm: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((values) => values.next === values.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

interface SuperPasswordPageProps {
  directory?: DirectoryRepository
}

/**
 * Super password management (spec SA-4): the envelope's superAdminPassword is
 * replaced only when the new value and its confirmation match; a mismatch is
 * rejected and the old password stays in place.
 */
export default function SuperPasswordPage({
  directory = storage,
}: SuperPasswordPageProps) {
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { next: "", confirm: "" },
  })

  const onSubmit = (values: PasswordFormValues) => {
    if (values.next !== values.confirm) {
      setPasswordError("Las contraseñas no coinciden.")
      return
    }
    directory.setSuperAdminPassword(values.next)
    toast.success("Contraseña actualizada")
  }

  return (
    <section aria-labelledby="password-title">
      <header className="mb-6">
        <h1
          id="password-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Contraseña del portal
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cambia la contraseña de super administrador que protege /admin.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <Field>
          <FieldLabel htmlFor="super-password-next">Nueva contraseña</FieldLabel>
          <FieldContent>
            <Input
              id="super-password-next"
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
              aria-invalid={!!errors.next}
              {...register("next", { onChange: () => setPasswordError(null) })}
            />
            <FieldError>{errors.next?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="super-password-confirm">
            Confirmar nueva contraseña
          </FieldLabel>
          <FieldContent>
            <Input
              id="super-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
              aria-invalid={!!errors.confirm || passwordError !== null}
              {...register("confirm", { onChange: () => setPasswordError(null) })}
            />
            {(errors.confirm?.message ?? passwordError) && (
              <FieldError role="alert">
                <CircleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {errors.confirm?.message ?? passwordError}
              </FieldError>
            )}
          </FieldContent>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" className="w-fit">
            <KeyRound data-icon="inline-start" />
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </section>
  )
}