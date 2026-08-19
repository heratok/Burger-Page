import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { CircleAlert, Save } from "lucide-react"
import { Button } from "@/shared/ui/ui/button"
import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/ui/ui/field"
import { Input } from "@/shared/ui/ui/input"
import { storage } from "@/shared/storage/storage"
import { DefaultThemeScope } from "@/shared/ui/ThemeScope"
import NotFoundState from "@/shared/ui/NotFoundState"
import type { DirectoryRepository } from "@/shared/storage/repository"

/** Color tokens use the #RRGGBB contract enforced across the app. */
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa formato #RRGGBB)")

/** Edit form: branding + palette + admin password (with confirmation, SA-4). */
const editSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{9,15}$/, "Número de WhatsApp inválido (solo dígitos)"),
  logo: z.string().trim().min(2, "Indica la URL del logo"),
  accent: colorSchema,
  primary: colorSchema,
  background: colorSchema,
  surface: colorSchema,
  adminPassword: z.string().min(1, "La contraseña no puede estar vacía"),
  adminPasswordConfirm: z.string().min(1, "Confirma la contraseña"),
})

type EditFormValues = z.infer<typeof editSchema>

interface EditRestaurantPageProps {
  directory?: DirectoryRepository
}

/**
 * Edit restaurant (design D4, spec SA-2 Rename / SA-4 Scoped): branding and
 * palette tokens update scoped to this restaurant; the slug is immutable and
 * shown read-only. The admin password changes only after the confirmation
 * matches, and never touches other restaurants' gates.
 */
export default function EditRestaurantPage({
  directory = storage,
}: EditRestaurantPageProps) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const restaurant = directory
    .listRestaurants()
    .find((r) => r.id === id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: restaurant?.config.name ?? "",
      whatsapp: restaurant?.config.whatsapp ?? "",
      logo: restaurant?.config.logo ?? "",
      accent: restaurant?.palette.accent ?? "",
      primary: restaurant?.palette.primary ?? "",
      background: restaurant?.palette.background ?? "",
      surface: restaurant?.palette.surface ?? "",
      adminPassword: restaurant?.config.adminPassword ?? "",
      adminPasswordConfirm: restaurant?.config.adminPassword ?? "",
    },
  })

  if (!restaurant) {
    return (
      <DefaultThemeScope>
        <NotFoundState />
      </DefaultThemeScope>
    )
  }

  const onSubmit = (values: EditFormValues) => {
    if (values.adminPassword !== values.adminPasswordConfirm) {
      setPasswordError("Las contraseñas no coinciden.")
      return
    }
    directory.updateRestaurant(restaurant.id, {
      name: values.name,
      whatsapp: values.whatsapp,
      logo: values.logo,
      adminPassword: values.adminPassword,
      palette: {
        accent: values.accent,
        primary: values.primary,
        background: values.background,
        surface: values.surface,
      },
    })
    toast.success("Cambios guardados")
    navigate("/admin/restaurants")
  }

  return (
    <section aria-labelledby="edit-title">
      <header className="mb-6">
        <h1
          id="edit-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Editar restaurante
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Actualiza la marca, los colores y el acceso de «{restaurant.config.name}».
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <Field>
          <FieldLabel htmlFor="edit-name">Nombre del restaurante</FieldLabel>
          <FieldContent>
            <Input
              id="edit-name"
              type="text"
              placeholder="Ej: Pizzería Bella Napoli"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-slug">Slug</FieldLabel>
          <FieldContent>
            <Input
              id="edit-slug"
              type="text"
              value={restaurant.slug}
              disabled
              aria-describedby="edit-slug-hint"
            />
            <p id="edit-slug-hint" className="mt-1 text-xs text-text-secondary">
              El slug no cambia después de la creación; los enlaces existentes
              siguen funcionando.
            </p>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-whatsapp">WhatsApp (con código de país)</FieldLabel>
          <FieldContent>
            <Input
              id="edit-whatsapp"
              type="tel"
              inputMode="numeric"
              placeholder="573022575805"
              aria-invalid={!!errors.whatsapp}
              {...register("whatsapp")}
            />
            <FieldError>{errors.whatsapp?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-logo">Logo (URL)</FieldLabel>
          <FieldContent>
            <Input
              id="edit-logo"
              type="url"
              placeholder="/logo.jpg"
              aria-invalid={!!errors.logo}
              {...register("logo")}
            />
            <FieldError>{errors.logo?.message}</FieldError>
          </FieldContent>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-accent">Color de acento</FieldLabel>
            <FieldContent>
              <Input
                id="edit-accent"
                type="text"
                placeholder="#FF7A21"
                maxLength={7}
                aria-invalid={!!errors.accent}
                {...register("accent")}
              />
              <FieldError>{errors.accent?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-primary">Color primario</FieldLabel>
            <FieldContent>
              <Input
                id="edit-primary"
                type="text"
                placeholder="#FF7A21"
                maxLength={7}
                aria-invalid={!!errors.primary}
                {...register("primary")}
              />
              <FieldError>{errors.primary?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-background">Color de fondo</FieldLabel>
            <FieldContent>
              <Input
                id="edit-background"
                type="text"
                placeholder="#0F1112"
                maxLength={7}
                aria-invalid={!!errors.background}
                {...register("background")}
              />
              <FieldError>{errors.background?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-surface">Color de superficie</FieldLabel>
            <FieldContent>
              <Input
                id="edit-surface"
                type="text"
                placeholder="#181A1B"
                maxLength={7}
                aria-invalid={!!errors.surface}
                {...register("surface")}
              />
              <FieldError>{errors.surface?.message}</FieldError>
            </FieldContent>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="edit-password">Contraseña de administrador</FieldLabel>
            <FieldContent>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••"
                aria-invalid={!!errors.adminPassword}
                {...register("adminPassword", {
                  onChange: () => setPasswordError(null),
                })}
              />
              <FieldError>{errors.adminPassword?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-password-confirm">
              Confirmar contraseña de administrador
            </FieldLabel>
            <FieldContent>
              <Input
                id="edit-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••"
                aria-invalid={!!errors.adminPasswordConfirm || passwordError !== null}
                {...register("adminPasswordConfirm", {
                  onChange: () => setPasswordError(null),
                })}
              />
              {(errors.adminPasswordConfirm?.message ?? passwordError) && (
                <FieldError role="alert">
                  <CircleAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  {errors.adminPasswordConfirm?.message ?? passwordError}
                </FieldError>
              )}
            </FieldContent>
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="w-fit">
            <Save data-icon="inline-start" />
            Guardar cambios
          </Button>
        </div>
      </form>
    </section>
  )
}