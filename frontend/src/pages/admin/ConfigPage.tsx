import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { storage } from "@/lib/storage"
import { applyTheme } from "@/lib/theme"
import type { RestaurantConfig } from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"

/** Color tokens use the #RRGGBB contract enforced across the app. */
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usa formato #RRGGBB)")

/** Config form schema. Currency is intentionally absent (fixed COP, spec). */
const configSchema = z.object({
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
})

type ConfigFormValues = z.infer<typeof configSchema>

interface ConfigPageProps {
  repo?: RestaurantRepository
}

export default function ConfigPage({ repo = storage }: ConfigPageProps) {
  const config = repo.getConfig()
  const palette = repo.getPalette()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      name: config.name,
      whatsapp: config.whatsapp,
      logo: config.logo,
      accent: palette.accent,
      primary: palette.primary,
      background: palette.background,
      surface: palette.surface,
      adminPassword: config.adminPassword,
    },
  })

  const onSubmit = (values: ConfigFormValues) => {
    const next: RestaurantConfig = {
      name: values.name,
      whatsapp: values.whatsapp,
      logo: values.logo,
      accent: values.accent,
      adminPassword: values.adminPassword,
    }
    repo.saveConfig(next)
    // Palette tokens persist scoped to this restaurant (design D1, SA-4 Scoped).
    repo.savePalette({
      accent: values.accent,
      primary: values.primary,
      background: values.background,
      surface: values.surface,
    })
    applyTheme({
      accent: values.accent,
      primary: values.primary,
      background: values.background,
      surface: values.surface,
    })
    toast.success("Configuración guardada")
  }

  return (
    <section aria-labelledby="config-title">
      <header className="mb-6">
        <h1
          id="config-title"
          className="text-2xl font-bold tracking-tight text-text-primary"
        >
          Configuración
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Datos del restaurante: marca, WhatsApp, logo, color y acceso admin.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <Field>
          <FieldLabel htmlFor="config-name">Nombre del restaurante</FieldLabel>
          <FieldContent>
            <Input
              id="config-name"
              type="text"
              placeholder="BURGER PAGE"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="config-whatsapp">WhatsApp (con código de país)</FieldLabel>
          <FieldContent>
            <Input
              id="config-whatsapp"
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
          <FieldLabel htmlFor="config-logo">Logo (URL)</FieldLabel>
          <FieldContent>
            <Input
              id="config-logo"
              type="url"
              placeholder="/logo.jpg"
              aria-invalid={!!errors.logo}
              {...register("logo")}
            />
            <FieldError>{errors.logo?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="config-accent">Color de acento</FieldLabel>
          <FieldContent>
            <Input
              id="config-accent"
              type="text"
              placeholder="#FF7A21"
              maxLength={7}
              aria-invalid={!!errors.accent}
              {...register("accent")}
            />
            <FieldError>{errors.accent?.message}</FieldError>
          </FieldContent>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="config-primary">Color primario</FieldLabel>
            <FieldContent>
              <Input
                id="config-primary"
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
            <FieldLabel htmlFor="config-background">Color de fondo</FieldLabel>
            <FieldContent>
              <Input
                id="config-background"
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
            <FieldLabel htmlFor="config-surface">Color de superficie</FieldLabel>
            <FieldContent>
              <Input
                id="config-surface"
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
          <FieldLabel htmlFor="config-password">Contraseña de administrador</FieldLabel>
          <FieldContent>
            <Input
              id="config-password"
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
            <Settings data-icon="inline-start" />
            Guardar configuración
          </Button>
        </div>
      </form>
    </section>
  )
}