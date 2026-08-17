import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { PackageOpen, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { storage } from "@/lib/storage"
import type { RestaurantRepository } from "@/lib/repository"
import type { Product } from "@/lib/domain"
import { formatCOP } from "@/lib/whatsapp"
import {
  ADMIN_LIMITS,
  productSchema,
  type ProductFormInput,
  type ProductFormValues,
} from "@/lib/admin-validation"

interface ProductsPageProps {
  repo?: RestaurantRepository
}

export default function ProductsPage({ repo = storage }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>(() => repo.listProducts())
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const dialogOpen = creating || editing !== null

  const closeDialog = () => {
    setCreating(false)
    setEditing(null)
  }

  const handleSave = (values: ProductFormValues) => {
    const product: Product = {
      id: editing?.id ?? crypto.randomUUID(),
      name: values.name,
      src: values.src,
      price: values.price,
      description: values.description,
      available: values.available,
    }
    repo.saveProduct(product)
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === product.id)
      if (index === -1) return [...prev, product]
      const next = [...prev]
      next[index] = product
      return next
    })
    toast.success(editing ? "Producto actualizado" : "Producto creado")
    closeDialog()
  }

  const toggleAvailability = (product: Product) => {
    const updated = { ...product, available: !product.available }
    repo.saveProduct(updated)
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const confirmDelete = () => {
    if (!deleting) return
    repo.deleteProduct(deleting.id)
    setProducts((prev) => prev.filter((p) => p.id !== deleting.id))
    toast.success("Producto eliminado")
    setDeleting(null)
  }

  return (
    <section aria-labelledby="products-title">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            id="products-title"
            className="text-2xl font-bold tracking-tight text-text-primary"
          >
            Productos
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Administra el menú: precios, imágenes y disponibilidad.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Nuevo producto
        </Button>
      </header>

      {products.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No hay productos</EmptyTitle>
            <EmptyDescription>
              Crea el primer producto con el botón «Nuevo producto».
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          role="list"
          aria-label="Lista de productos"
          className="flex flex-col gap-2"
        >
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-card p-3"
            >
              <img
                src={product.src}
                alt=""
                className="size-10 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {product.name}
                </p>
                <p className="text-sm text-text-secondary">
                  {formatCOP(product.price)}
                </p>
              </div>
              <Badge variant={product.available ? "default" : "secondary"}>
                {product.available ? "Disponible" : "Oculto"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={product.available}
                aria-label={`Alternar disponibilidad de ${product.name}`}
                onClick={() => toggleAvailability(product)}
              >
                {product.available ? "Ocultar" : "Mostrar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Editar ${product.name}`}
                onClick={() => setEditing(product)}
              >
                <Pencil />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                aria-label={`Eliminar ${product.name}`}
                onClick={() => setDeleting(product)}
              >
                <Trash2 />
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen && (
        <ProductDialog
          open
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
          product={editing}
          onSave={handleSave}
        />
      )}

      <DeleteDialog
        product={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSave: (values: ProductFormValues) => void
}

function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: ProductDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      price: product ? String(product.price) : "",
      src: product?.src ?? "",
      description: product?.description ?? "",
      available: product?.available ?? true,
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            {product
              ? `Actualiza los datos de «${product.name}».`
              : "Completa los datos del nuevo producto."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} noValidate className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
            <FieldContent>
              <Input
                id="product-name"
                type="text"
                placeholder="Ej: Misisipi"
                maxLength={ADMIN_LIMITS.productName.max}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="product-price">Precio (COP)</FieldLabel>
            <FieldContent>
              <Input
                id="product-price"
                type="text"
                inputMode="numeric"
                placeholder="27000"
                maxLength={7}
                aria-invalid={!!errors.price}
                {...register("price")}
              />
              <FieldError>{errors.price?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="product-src">Imagen (URL)</FieldLabel>
            <FieldContent>
              <Input
                id="product-src"
                type="url"
                placeholder="https://…"
                maxLength={ADMIN_LIMITS.imageUrl.max}
                aria-invalid={!!errors.src}
                {...register("src")}
              />
              <FieldError>{errors.src?.message}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
            <FieldContent>
              <Textarea
                id="product-description"
                rows={3}
                placeholder="Descripción corta del producto"
                maxLength={ADMIN_LIMITS.productDescription.max}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError>{errors.description?.message}</FieldError>
            </FieldContent>
          </Field>
          <Label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-(--color-accent)"
              {...register("available")}
            />
            Disponible en el menú
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  product: Product | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteDialog({ product, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar producto</DialogTitle>
          <DialogDescription>
            ¿Eliminar «{product?.name}»? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
