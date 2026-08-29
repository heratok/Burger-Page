import { z } from "zod"
import { cleanPhoneNumber } from "./utils"

/**
 * Límites de longitud de los campos del formulario de pedido.
 * Un solo lugar de verdad para maxLength (HTML) y validación (zod).
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
