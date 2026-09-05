import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Home,
  MapPin,
  Phone,
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
import CharacterCounter from "@/components/CharacterCounter"
import { formSchema, LIMITS, type FormValues } from "@/lib/validation"
import { calculateChange } from "./whatsapp"
import { cartItemToOrderItem, type CartItem } from "./cartEngine"
import { useRestaurant } from "@/context/RestaurantContext"
import { formatCurrency } from "@/lib/utils"

const METODOS = [
  { value: "Efectivo", Icon: Banknote },
  { value: "Transferencia", Icon: CreditCard },
] as const

export interface CheckoutFormProps {
  onClose: () => void
  onBackToCart: () => void
  cartItems: CartItem[]
}

export default function CheckoutForm({ onClose, onBackToCart, cartItems }: CheckoutFormProps) {
  const { storeConfig, addOrder } = useRestaurant()
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

  const total = cartItems.reduce(
    (acc, item) => acc + item.total,
    0
  )

  const cambio = calculateChange(total, pagoCon)

  const onSubmit = (values: FormValues) => {
    // 1. Register order in CRM context
    addOrder({
      customer: {
        nombre: values.nombre,
        telefono: values.telefono,
        direccion: values.dir,
        barrio: values.barrio,
      },
      items: cartItems.map(cartItemToOrderItem),
      total,
      deliveryFee: storeConfig.deliveryFee,
      finalTotal: total + storeConfig.deliveryFee,
      metodo: values.metodo,
      pagoCon: values.pagoCon,
      cambio: cambio || undefined,
      comentario: values.mensaje,
      status: "pending",
    })

    // 2. Direct sale confirmation feedback
    toast.success("¡Venta registrada con éxito!", {
      description: `${values.nombre} • Total: ${formatCurrency(total + storeConfig.deliveryFee)}`,
    })
    onClose()
  }

  return (
    <div className="mx-auto max-w-(--container) px-4 pb-12 md:px-6 lg:px-8">
      <header className="mb-6">
        <h1
          style={{ color: "var(--color-text-primary)" }}
          className="text-2xl font-bold tracking-tight"
        >
          Finalizar pedido
        </h1>
        <p
          style={{ color: "var(--color-text-secondary)" }}
          className="mt-1 text-sm"
        >
          Revisa el resumen y déjanos tus datos de contacto.
        </p>
      </header>

      <FormSummary cartItems={cartItems} total={total} />

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
            <FieldLegend className="text-text-primary font-semibold">
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
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition duration-150 ease-out focus-within:ring-2 focus-within:ring-accent ${
                      active
                        ? "border-accent bg-accent-soft text-text-primary font-bold"
                        : "border-border-subtle bg-bg-elevated text-text-primary hover:border-border-strong"
                    }`}
                  >
                    <RadioGroupItem value={value} id={`metodo-${value}`} className="sr-only" />
                    <span
                      aria-hidden="true"
                      style={active ? { backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" } : undefined}
                      className={`inline-flex size-9 items-center justify-center rounded-full ${
                        active ? "text-white shadow-xs" : "bg-bg-elevated-2 text-text-muted"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold text-text-primary">{value}</span>
                  </Label>
                )
              })}
            </RadioGroup>
          </FieldSet>

          {metodo === "Efectivo" && (
            <Field>
              <div className="mb-1.5 flex flex-col gap-0.5">
                <FieldLabel htmlFor="pagoCon" className="text-text-primary font-semibold">¿Con cuánto pagas?</FieldLabel>
                <FieldDescription className="text-text-muted">
                  Opcional. Si nos indicas el valor, calculamos tu cambio.
                </FieldDescription>
              </div>
              <InputGroup className="bg-bg-input border-border-subtle">
                <InputGroupAddon align="inline-start" className="pl-3 [&>svg]:size-4">
                  <Wallet className="text-text-muted" />
                </InputGroupAddon>
                <InputGroupInput
                  id="pagoCon"
                  type="text"
                  inputMode="numeric"
                  placeholder="50000"
                  maxLength={LIMITS.pagoCon.max}
                  className="text-text-primary"
                  {...register("pagoCon")}
                />
              </InputGroup>
              {cambio !== null && (
                <FieldDescription className="text-text-secondary">
                  Tu cambio:{" "}
                  <span className="font-bold text-accent">
                    {formatCurrency(cambio)}
                  </span>
                </FieldDescription>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="mensaje" className="text-text-primary font-semibold">Comentario</FieldLabel>
            <Textarea
              id="mensaje"
              rows={3}
              placeholder="Algo que debamos saber sobre tu pedido"
              maxLength={LIMITS.mensaje.max}
              className="bg-bg-input border-border-subtle text-text-primary"
              {...register("mensaje")}
            />
            <CharacterCounter value={watch("mensaje") ?? ""} max={LIMITS.mensaje.max} />
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            type="submit"
            variant="default"
            size="lg"
            style={{ backgroundColor: storeConfig.primaryColor, color: "#FFFFFF" }}
            className="h-12 flex-1 text-base text-white font-bold shadow-md cursor-pointer hover:opacity-90"
          >
            <Check data-icon="inline-start" />
            Registrar venta
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBackToCart}
            className="h-12 flex-1 text-base font-bold cursor-pointer"
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
  cartItems: CartItem[]
  total: number
}

function FormSummary({ cartItems, total }: FormSummaryProps) {
  const { storeConfig } = useRestaurant()
  const [open, setOpen] = useState(true)

  return (
    <section
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        borderColor: "var(--color-border-subtle)",
      }}
      className="mb-6 overflow-hidden rounded-2xl border shadow-xs"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="order-summary"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition duration-150 ease-out focus:outline-none focus-visible:focus-ring cursor-pointer"
      >
        <span
          style={{ color: "var(--color-text-primary)" }}
          className="text-sm font-bold"
        >
          Resumen ({cartItems.length}{" "}
          {cartItems.length === 1 ? "producto" : "productos"})
        </span>
        <span className="flex items-center gap-3">
          <span
            style={{ color: storeConfig.primaryColor }}
            className="text-base font-black"
          >
            {formatCurrency(total)}
          </span>
          <ChevronDown
            style={{ color: "var(--color-text-muted)" }}
            className={`size-4 transition duration-150 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>
      {open && (
        <ul id="order-summary" className="space-y-2 px-4 pt-1 pb-4 border-t border-slate-100 dark:border-slate-800/40">
          {cartItems.map((item, i) => (
            <li
              key={item.id || i}
              style={{ color: "var(--color-text-secondary)" }}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate">
                {item.cantidad}× {item.name}
              </span>
              <span
                style={{ color: "var(--color-text-primary)" }}
                className="ml-3 shrink-0 font-bold"
              >
                {formatCurrency(item.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
