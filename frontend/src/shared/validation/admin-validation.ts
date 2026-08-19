import { z } from "zod"

/**
 * Límites de longitud de los formularios de administración.
 * Un solo lugar de verdad para maxLength (HTML) y validación (zod),
 * mismo patrón que src/shared/validation/validation.ts.
 */
export const ADMIN_LIMITS = {
  productName: { min: 2, max: 60 },
  productDescription: { max: 200 },
  modifierName: { min: 2, max: 40 },
  price: { min: 100, max: 1_000_000 },
  imageUrl: { max: 500 },
} as const

/**
 * Precio como texto numérico (input): valida dígitos, convierte a número
 * y aplica el rango permitido. Determinista y sin NaN.
 */
const priceField = z
  .string()
  .trim()
  .regex(/^\d{1,7}$/, { message: "Ingresa un precio válido (solo números)." })
  .transform(Number)
  .refine((value) => value >= ADMIN_LIMITS.price.min, {
    message: `El precio mínimo es ${ADMIN_LIMITS.price.min}.`,
  })
  .refine((value) => value <= ADMIN_LIMITS.price.max, {
    message: `El precio máximo es ${ADMIN_LIMITS.price.max}.`,
  })

const imageUrlField = z
  .string()
  .trim()
  .max(ADMIN_LIMITS.imageUrl.max, {
    message: `La URL de la imagen es muy larga (máx. ${ADMIN_LIMITS.imageUrl.max} caracteres).`,
  })
  .optional()
  .default("")

const nameField = (limits: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .min(limits.min, {
      message: `Ingresa un nombre (mín. ${limits.min} caracteres).`,
    })
    .max(limits.max, {
      message: `El nombre es muy largo (máx. ${limits.max} caracteres).`,
    })

export const productSchema = z.object({
  name: nameField(ADMIN_LIMITS.productName),
  price: priceField,
  src: imageUrlField,
  description: z
    .string()
    .trim()
    .max(ADMIN_LIMITS.productDescription.max, {
      message: `La descripción es muy larga (máx. ${ADMIN_LIMITS.productDescription.max} caracteres).`,
    })
    .optional()
    .default(""),
  available: z.boolean().default(true),
})

export type ProductFormValues = z.infer<typeof productSchema>

/** Tipo de entrada del formulario (precio como texto) antes de las transformaciones del schema. */
export type ProductFormInput = z.input<typeof productSchema>

export const modifierSchema = z.object({
  name: nameField(ADMIN_LIMITS.modifierName),
  price: priceField,
  src: imageUrlField,
  available: z.boolean().default(true),
})

export type ModifierFormValues = z.infer<typeof modifierSchema>