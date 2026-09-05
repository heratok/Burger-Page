import { z } from "zod"
import { cleanPhoneNumber } from "./utils"

/**
 * Límites de longitud de los campos del formulario de pedido en storefront.
 */
export const LIMITS = {
  nombre: { min: 2, max: 60 },
  telefono: { min: 7, max: 15 },
  dir: { max: 100 },
  barrio: { max: 60 },
  pagoCon: { max: 9 },
  mensaje: { max: 300 },
  observaciones: { max: 200 },
  busqueda: { max: 50 },
} as const

export const formSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(LIMITS.nombre.min, {
      message: `Ingresa tu nombre (mín. ${LIMITS.nombre.min} caracteres).`,
    })
    .max(LIMITS.nombre.max, {
      message: `El nombre es muy largo (máx. ${LIMITS.nombre.max} caracteres).`,
    }),
  telefono: z
    .string()
    .trim()
    .transform((v) => cleanPhoneNumber(v))
    .refine((v) => v.length >= LIMITS.telefono.min, {
      message: `Ingresa un celular válido (mín. ${LIMITS.telefono.min} dígitos).`,
    })
    .refine((v) => v.length <= LIMITS.telefono.max, {
      message: `El celular es muy largo (máx. ${LIMITS.telefono.max} dígitos).`,
    }),
  dir: z
    .string()
    .trim()
    .min(1, { message: "La dirección es obligatoria." })
    .max(LIMITS.dir.max, {
      message: `La dirección es muy larga (máx. ${LIMITS.dir.max} caracteres).`,
    }),
  barrio: z
    .string()
    .trim()
    .min(1, { message: "Indícanos tu barrio." })
    .max(LIMITS.barrio.max, {
      message: `El barrio es muy largo (máx. ${LIMITS.barrio.max} caracteres).`,
    }),
  metodo: z.enum(["Efectivo", "Transferencia"]),
  pagoCon: z
    .string()
    .regex(new RegExp(`^\\d{0,${LIMITS.pagoCon.max}}$`), {
      message: `Máximo ${LIMITS.pagoCon.max} dígitos.`,
    })
    .optional(),
  mensaje: z
    .string()
    .max(LIMITS.mensaje.max, {
      message: `El comentario es muy largo (máx. ${LIMITS.mensaje.max} caracteres).`,
    })
    .optional(),
})

export type FormValues = z.infer<typeof formSchema>

/**
 * Límites de longitud y valores numéricos para módulos de administración y paneles de control.
 * Un solo lugar de verdad para inputs HTML y validación Zod.
 */
export const ADMIN_LIMITS = {
  auth: {
    username: { min: 3, max: 50 },
    password: { min: 4, max: 100 },
  },
  restaurant: {
    name: { min: 2, max: 80 },
    slug: { min: 2, max: 40 },
    tagline: { max: 120 },
    whatsapp: { min: 7, max: 20 },
    address: { max: 150 },
    announcement: { max: 150 },
    openingHours: { max: 100 },
    deliveryTime: { max: 50 },
    deliveryFee: { min: 0, max: 10_000_000 },
    minOrderAmount: { min: 0, max: 10_000_000 },
  },
  product: {
    name: { min: 2, max: 80 },
    description: { max: 350 },
    price: { min: 100, max: 50_000_000 },
    prepTime: { min: 0, max: 300 },
  },
  category: {
    name: { min: 2, max: 50 },
  },
  addition: {
    name: { min: 2, max: 60 },
    price: { min: 0, max: 10_000_000 },
  },
  inventory: {
    name: { min: 2, max: 80 },
    stock: { min: 0, max: 1_000_000 },
    minAlert: { min: 0, max: 100_000 },
    cost: { min: 0, max: 50_000_000 },
  },
  supplier: {
    name: { min: 2, max: 80 },
    contact: { max: 80 },
    phone: { min: 7, max: 20 },
    email: { max: 100 },
    notes: { max: 300 },
  },
  manualSale: {
    name: { max: 80 },
    phone: { max: 20 },
    address: { max: 150 },
    barrio: { max: 80 },
    table: { max: 25 },
    notes: { max: 250 },
    itemNote: { max: 150 },
    pagoCon: { max: 12 },
    search: { max: 60 },
  },
} as const

// Zod Schemas for Admin forms
export const adminAuthSchema = z.object({
  username: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.auth.username.min, {
      message: `El usuario debe tener al menos ${ADMIN_LIMITS.auth.username.min} caracteres.`,
    })
    .max(ADMIN_LIMITS.auth.username.max, {
      message: `El usuario no puede superar ${ADMIN_LIMITS.auth.username.max} caracteres.`,
    }),
  password: z
    .string()
    .min(ADMIN_LIMITS.auth.password.min, {
      message: `La contraseña debe tener al menos ${ADMIN_LIMITS.auth.password.min} caracteres.`,
    })
    .max(ADMIN_LIMITS.auth.password.max, {
      message: `La contraseña no puede superar ${ADMIN_LIMITS.auth.password.max} caracteres.`,
    }),
})

export const createRestaurantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.restaurant.name.min, {
      message: `El nombre debe tener al menos ${ADMIN_LIMITS.restaurant.name.min} caracteres.`,
    })
    .max(ADMIN_LIMITS.restaurant.name.max, {
      message: `El nombre no puede superar ${ADMIN_LIMITS.restaurant.name.max} caracteres.`,
    }),
  slug: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.restaurant.slug.min, {
      message: `El slug debe tener al menos ${ADMIN_LIMITS.restaurant.slug.min} caracteres.`,
    })
    .max(ADMIN_LIMITS.restaurant.slug.max, {
      message: `El slug no puede superar ${ADMIN_LIMITS.restaurant.slug.max} caracteres.`,
    })
    .regex(/^[a-z0-9-]+$/, {
      message: "El slug solo puede contener letras minúsculas, números y guiones.",
    }),
  tagline: z.string().trim().max(ADMIN_LIMITS.restaurant.tagline.max).optional(),
  whatsappNumber: z.string().trim().max(ADMIN_LIMITS.restaurant.whatsapp.max).optional(),
  deliveryFee: z.number().min(0).max(ADMIN_LIMITS.restaurant.deliveryFee.max).default(0),
  minOrderAmount: z.number().min(0).max(ADMIN_LIMITS.restaurant.minOrderAmount.max).default(0),
  address: z.string().trim().max(ADMIN_LIMITS.restaurant.address.max).optional(),
  adminUsername: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.auth.username.min)
    .max(ADMIN_LIMITS.auth.username.max),
  adminPassword: z
    .string()
    .min(ADMIN_LIMITS.auth.password.min)
    .max(ADMIN_LIMITS.auth.password.max),
})

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.product.name.min, {
      message: `El nombre del plato debe tener al menos ${ADMIN_LIMITS.product.name.min} caracteres.`,
    })
    .max(ADMIN_LIMITS.product.name.max, {
      message: `El nombre no puede superar ${ADMIN_LIMITS.product.name.max} caracteres.`,
    }),
  price: z
    .number()
    .min(ADMIN_LIMITS.product.price.min, {
      message: `El precio mínimo es de $${ADMIN_LIMITS.product.price.min}.`,
    })
    .max(ADMIN_LIMITS.product.price.max, {
      message: `El precio no puede superar $${ADMIN_LIMITS.product.price.max}.`,
    }),
  description: z
    .string()
    .trim()
    .max(ADMIN_LIMITS.product.description.max, {
      message: `La descripción no puede superar ${ADMIN_LIMITS.product.description.max} caracteres.`,
    })
    .optional(),
  category: z.string().trim().min(1, { message: "Selecciona una categoría válida." }),
  preparationTimeMinutes: z
    .number()
    .min(ADMIN_LIMITS.product.prepTime.min)
    .max(ADMIN_LIMITS.product.prepTime.max)
    .optional(),
})

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(ADMIN_LIMITS.supplier.name.min, { message: "El nombre del proveedor es obligatorio." })
    .max(ADMIN_LIMITS.supplier.name.max, { message: "El nombre es muy largo." }),
  contactName: z.string().trim().max(ADMIN_LIMITS.supplier.contact.max).optional(),
  phone: z.string().trim().max(ADMIN_LIMITS.supplier.phone.max).optional(),
  email: z.string().trim().max(ADMIN_LIMITS.supplier.email.max).email({ message: "Email inválido" }).optional().or(z.literal("")),
  notes: z.string().trim().max(ADMIN_LIMITS.supplier.notes.max).optional(),
})
