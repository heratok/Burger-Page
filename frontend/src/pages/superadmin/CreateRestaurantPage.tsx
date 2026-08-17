import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { CircleAlert, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { storage } from "@/lib/storage"
import { DEFAULT_PALETTE } from "@/data/data"
import { slugify } from "@/lib/slug"
import type { DirectoryRepository } from "@/lib/repository"

/** Color tokens use the #RRGGBB contract enforced across the app. */
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa formato #RRGGBB)")

/** Create form: name/whatsapp/logo/palette/adminPassword + optional slug override. */
const createSchema = z.object({
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
  slug: z
    .string()
    .trim()
    .regex(
      /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
      "Slug inválido (solo minúsculas, números y guiones)"
    ),
})

type CreateFormValues = z.infer<typeof createSchema>

interface CreateRestaurantPageProps {
  directory?: DirectoryRepository
}

/**
 * Create restaurant (design D4, spec SA-2): auto-slug from the name with
 * transliteration (Ñoquis Bar → noquis-bar), unique suffix on collision, and
 * an optional manual slug override that is rejected when already in use. The
 * created restaurant shows up in the directory immediately.
 */
export default function CreateRestaurantPage({
  directory = storage,
}: CreateRestaurantPageProps) {
  const navigate = useNavigate()
  const [slugError, setSlugError] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      whatsapp: "",
      logo: "",
      accent: DEFAULT_PALETTE.accent,
      primary: DEFAULT_PALETTE.primary,
      background: DEFAULT_PALETTE.background,
      surface: DEFAULT_PALETTE.surface,
      adminPassword: "",
      slug: "",
    },
  })

  const autoSlug = slugify(nameValue)

  const onSubmit = (values: CreateFormValues) => {
    try {
      directory.createRestaurant({
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
        slug: values.slug === "" ? undefined : values.slug,
      })
      toast.success("Restaurante creado")
      navigate("/admin/restaurants")
    } catch {
      // The only rejection from createRestaurant is a taken manual slug (SA-2).
      setSlugError(`El slug «${values.slug}» ya está en uso.`)
    }
  }

  return (
    <section aria-labelledby="create-title">
      <header className="mb-6">
        <h1
          id="create-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Nuevo restaurante
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          El restaurante aparecerá en el directorio con su tienda y admin propios.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <Field>
          <FieldLabel htmlFor="create-name">Nombre del restaurante</FieldLabel>
          <FieldContent>
            <Input
              id="create-name"
              type="text"
              placeholder="Ej: Pizzería Bella Napoli"
              aria-invalid={!!errors.name}
              {...register("name", {
                onChange: (event) => setNameValue(event.target.value),
              })}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="create-slug">Slug (opcional)</FieldLabel>
          <FieldContent>
            <Input
              id="create-slug"
              type="text"
              placeholder={autoSlug || "url-amigable"}
              maxLength={40}
              aria-invalid={!!errors.slug || slugError !== null}
              {...register("slug")}
            />
            <p className="mt-1 text-xs text-text-secondary">
              {autoSlug
                ? `Slug generado: ${autoSlug}`
                : "Se genera automáticamente desde el nombre."}
            </p>
            {(errors.slug?.message ?? slugError) && (
              <FieldError role="alert">
                <CircleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {errors.slug?.message ?? slugError}
              </FieldError>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="create-whatsapp">WhatsApp (con código de país)</FieldLabel>
          <FieldContent>
            <Input
              id="create-whatsapp"
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
          <FieldLabel htmlFor="create-logo">Logo (URL)</FieldLabel>
          <FieldContent>
            <Input
              id="create-logo"
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
            <FieldLabel htmlFor="create-accent">Color de acento</FieldLabel>
            <FieldContent>
              <Input
                id="create-accent"
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
            <FieldLabel htmlFor="create-primary">Color primario</FieldLabel>
            <FieldContent>
              <Input
                id="create-primary"
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
            <FieldLabel htmlFor="create-background">Color de fondo</FieldLabel>
            <FieldContent>
              <Input
                id="create-background"
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
            <FieldLabel htmlFor="create-surface">Color de superficie</FieldLabel>
            <FieldContent>
              <Input
                id="create-surface"
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

        <Field>
          <FieldLabel htmlFor="create-password">Contraseña de administrador</FieldLabel>
          <FieldContent>
            <Input
              id="create-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
              aria-invalid={!!errors.adminPassword}
              {...register("adminPassword")}
            />
            <FieldError>{errors.adminPassword?.message}</FieldError>
          </FieldContent>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" className="w-fit">
            <Plus data-icon="inline-start" />
            Crear restaurante
          </Button>
        </div>
      </form>
    </section>
  )
}