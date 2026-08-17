import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Home,
  MapPin,
  Phone,
  Send,
  User,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import CharacterCounter from "../components/CharacterCounter"
import { formSchema, LIMITS, type FormValues } from "@/lib/validation"
import { buildOrderMessage, buildWhatsAppUrl, calculateChange } from "@/lib/whatsapp"
import { storage } from "@/lib/storage"
import type { CartItem, Order } from "@/lib/domain"
import type { RestaurantRepository } from "@/lib/repository"

const METODOS = [
  { value: "Efectivo", Icon: Banknote },
  { value: "Transferencia", Icon: CreditCard },
] as const

interface FormProps {
  cerrar: () => void
  cerrarForm: () => void
  mostrar: () => void
  items: CartItem[]
  repo?: RestaurantRepository
}

export default function Form({
  cerrar,
  cerrarForm,
  mostrar,
  items,
  repo = storage,
}: FormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      dir: "",
      barrio: "",
      metodo: "Efectivo",
      pagoCon: "",
      mensaje: "",
    },
  })

  const metodo = watch("metodo")
  const pagoCon = watch("pagoCon")

  const total = items.reduce((acc, item) => acc + item.total, 0)

  const cambio = calculateChange(total, pagoCon)

  const ocultar = () => {
    cerrar()
    cerrarForm()
    mostrar()
  }

  const onSubmit = (values: FormValues) => {
    const order: Omit<Order, "id" | "status" | "createdAt"> = {
      items,
      customer: {
        nombre: values.nombre,
        telefono: values.telefono,
        direccion: values.dir,
        barrio: values.barrio,
      },
      metodo: values.metodo,
      pagoCon: values.pagoCon || undefined,
      comentario: values.mensaje || undefined,
      total,
    }

    // Persist the order BEFORE the WhatsApp handoff (spec order-lifecycle).
    // Fail-closed: if the order cannot be stored, do not open WhatsApp.
    let saved: Order
    try {
      saved = repo.saveOrder(order)
    } catch {
      toast.error("No se pudo guardar el pedido. Intenta de nuevo.")
      return
    }

    const message = buildOrderMessage(
      {
        orderId: saved.id,
        customer: saved.customer,
        items: saved.items,
        metodo: saved.metodo,
        pagoCon: saved.pagoCon,
        comentario: saved.comentario,
      },
      repo.getConfig().name
    )
    window.open(
      buildWhatsAppUrl(repo.getConfig().whatsapp, message),
      "_blank",
      "noreferrer"
    )
  }

  return (
    <div className="mx-auto max-w-(--container) px-4 pb-12 md:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Finalizar pedido
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revisa el resumen y déjanos tus datos de contacto.
        </p>
      </header>

      <FormSummary items={items} total={total} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nombre">
              Nombre <span className="text-destructive" aria-hidden="true">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                <User className="text-text-muted" />
              </InputGroupAddon>
              <InputGroupInput
                id="nombre"
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                maxLength={LIMITS.nombre.max}
                aria-invalid={!!errors.nombre}
                {...register("nombre")}
              />
            </InputGroup>
            <FieldError className="flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" data-icon="inline-start" aria-hidden="true" />
              {errors.nombre?.message}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="telefono">
              Celular <span className="text-destructive" aria-hidden="true">*</span>
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                <Phone className="text-text-muted" />
              </InputGroupAddon>
              <InputGroupInput
                id="telefono"
                type="tel"
                inputMode="numeric"
                placeholder="3001234567"
                autoComplete="tel"
                maxLength={LIMITS.telefono.max}
                aria-invalid={!!errors.telefono}
                {...register("telefono")}
              />
            </InputGroup>
            <FieldError className="flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" data-icon="inline-start" aria-hidden="true" />
              {errors.telefono?.message}
            </FieldError>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="dir">
                Dirección <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                  <Home className="text-text-muted" />
                </InputGroupAddon>
                <InputGroupInput
                  id="dir"
                  type="text"
                  placeholder="Calle 123 #45-67"
                  autoComplete="street-address"
                  maxLength={LIMITS.dir.max}
                  aria-invalid={!!errors.dir}
                  {...register("dir")}
                />
              </InputGroup>
              <FieldError className="flex items-start gap-1.5">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" data-icon="inline-start" aria-hidden="true" />
                {errors.dir?.message}
              </FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="barrio">
                Barrio <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                  <MapPin className="text-text-muted" />
                </InputGroupAddon>
              <InputGroupInput
                id="barrio"
                type="text"
                placeholder="Tu barrio"
                autoComplete="address-level3"
                maxLength={LIMITS.barrio.max}
                aria-invalid={!!errors.barrio}
                {...register("barrio")}
              />
              </InputGroup>
              <FieldError className="flex items-start gap-1.5">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" data-icon="inline-start" aria-hidden="true" />
                {errors.barrio?.message}
              </FieldError>
            </Field>
          </div>

          <FieldSet>
            <FieldLegend>
              Método de pago <span className="text-destructive" aria-hidden="true">*</span>
            </FieldLegend>
            <RadioGroup
              value={metodo}
              onValueChange={(value) => setValue("metodo", value as FormValues["metodo"])}
              className="grid grid-cols-2 gap-3"
            >
              {METODOS.map(({ value, Icon }) => {
                const active = metodo === value
                return (
                  <Label
                    key={value}
                    data-slot="field-label"
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition duration-150 ease-out focus-within:ring-2 focus-within:ring-ring ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-foreground hover:border-border-strong"
                    }`}
                  >
                    <RadioGroupItem value={value} id={`metodo-${value}`} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-9 items-center justify-center rounded-full ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="text-sm font-medium">{value}</span>
                  </Label>
                )
              })}
            </RadioGroup>
          </FieldSet>

          {metodo === "Efectivo" && (
            <Field>
              <div className="mb-1.5 flex flex-col gap-0.5">
                <FieldLabel htmlFor="pagoCon">¿Con cuánto pagas?</FieldLabel>
                <FieldDescription>
                  Opcional. Si nos indicas el valor, calculamos tu cambio.
                </FieldDescription>
              </div>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                  <Wallet className="text-text-muted" />
                </InputGroupAddon>
                <InputGroupInput
                  id="pagoCon"
                  type="text"
                  inputMode="numeric"
                  placeholder="50000"
                  maxLength={LIMITS.pagoCon.max}
                  {...register("pagoCon")}
                />
              </InputGroup>
              {cambio !== null && (
                <FieldDescription>
                  Tu cambio:{" "}
                  <span className="font-semibold text-primary">
                    ${cambio.toLocaleString()}
                  </span>
                </FieldDescription>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="mensaje">Comentario</FieldLabel>
            <Textarea
              id="mensaje"
              rows={3}
              placeholder="Algo que debamos saber sobre tu pedido"
              maxLength={LIMITS.mensaje.max}
              {...register("mensaje")}
            />
            <CharacterCounter value={watch("mensaje") ?? ""} max={LIMITS.mensaje.max} />
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button type="submit" variant="default" size="lg" className="h-12 flex-1 text-base">
            <Send data-icon="inline-start" />
            Enviar pedido por WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={ocultar}
            className="h-12 flex-1 text-base"
          >
            <ArrowLeft data-icon="inline-start" />
            Volver
          </Button>
        </div>
      </form>
    </div>
  )
}

interface FormSummaryProps {
  items: CartItem[]
  total: number
}

function FormSummary({ items, total }: FormSummaryProps) {
  const [open, setOpen] = useState(true)

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border-subtle bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="order-summary"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition duration-150 ease-out hover:bg-muted/50 focus:outline-none focus-visible:focus-ring"
      >
        <span className="text-sm font-semibold text-foreground">
            Resumen ({items.length}{" "}
            {items.length === 1 ? "producto" : "productos"})
        </span>
        <span className="flex items-center gap-3">
          <span className="text-base font-bold text-primary">
            ${total.toLocaleString()}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition duration-150 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>
      {open && (
        <ul id="order-summary" className="space-y-2 px-4 pt-1 pb-4">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span className="truncate">
                {item.cantidad}× {item.name}
              </span>
              <span className="ml-3 shrink-0 font-semibold text-foreground">
                ${item.total.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}