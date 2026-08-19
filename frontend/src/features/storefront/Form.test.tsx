import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type {
  CartItem,
  Modifier,
  Order,
  Product,
  RestaurantConfig,
} from "@/shared/domain/domain"
import type { RestaurantRepository } from "@/shared/storage/repository"
import { Toaster } from "@/shared/ui/ui/sonner"
import Form from "./Form"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makeItem(id: string, total: number): CartItem {
  return {
    id,
    productId: id,
    name: `Item ${id}`,
    src: "",
    unitPrice: total,
    cantidad: 1,
    modifiers: [],
    observacion: "",
    total,
  }
}

function createFormRepo(options: { failSave?: boolean } = {}) {
  const repo: RestaurantRepository = {
    getConfig: () =>
      ({ name: "BURGER PAGE", whatsapp: "573022575805" }) as RestaurantConfig,
    saveConfig: vi.fn(),
    getPalette: () => ({ accent: "#FF7A21", primary: "#FF7A21", background: "#0F1112", surface: "#181A1B" }),
    savePalette: vi.fn(),
    listProducts: () => [] as Product[],
    saveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    listModifiers: () => [] as Modifier[],
    saveModifier: vi.fn(),
    deleteModifier: vi.fn(),
    listOrders: () => [] as Order[],
    saveOrder: vi.fn(() => {
      if (options.failSave) throw new Error("storage full")
      return {
        id: 123456,
        items: [],
        customer: {
          nombre: "",
          telefono: "",
          direccion: "",
          barrio: "",
        },
        metodo: "Efectivo",
        total: 0,
        status: "new",
        createdAt: new Date().toISOString(),
      } as Order
    }),
    updateOrderStatus: vi.fn(),
  }
  return { repo }
}

function renderForm(repo: RestaurantRepository, items: CartItem[] = [makeItem("a", 27000)]) {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
  render(
    <>
      <Form
        cerrar={vi.fn()}
        cerrarForm={vi.fn()}
        mostrar={vi.fn()}
        items={items}
        repo={repo}
      />
      <Toaster position="top-right" richColors closeButton />
    </>
  )
  return { openSpy }
}

async function submitValidForm() {
  fireEvent.change(screen.getByLabelText(/nombre/i), {
    target: { value: "Juan Pérez" },
  })
  fireEvent.change(screen.getByLabelText(/celular/i), {
    target: { value: "3001234567" },
  })
  fireEvent.change(screen.getByLabelText(/dirección/i), {
    target: { value: "Calle 1 #2-3" },
  })
  fireEvent.change(screen.getByLabelText(/barrio/i), {
    target: { value: "Centro" },
  })
  fireEvent.click(screen.getByRole("button", { name: /enviar pedido por whatsapp/i }))
}

describe("Form checkout persistence", () => {
  it("persists the order as new before opening WhatsApp", async () => {
    const { repo } = createFormRepo()
    const { openSpy } = renderForm(repo)

    await submitValidForm()

    await waitFor(() =>
      expect(repo.saveOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ nombre: "Juan Pérez" }),
          metodo: "Efectivo",
          total: 27000,
        })
      )
    )
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    const url = openSpy.mock.calls[0][0] as string
    expect(url.startsWith("https://wa.me/573022575805?text=")).toBe(true)
    expect(decodeURIComponent(url)).toContain("Orden: #123456")
    expect(decodeURIComponent(url)).toContain("NUEVO PEDIDO")
  })

  it("uses the WhatsApp number from the restaurant config", async () => {
    const { repo } = createFormRepo()
    const { openSpy } = renderForm(repo)

    await submitValidForm()

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    const url = openSpy.mock.calls[0][0] as string
    expect(url).toContain("wa.me/573022575805")
  })

  it("fails closed: storage failure shows an error and never opens WhatsApp", async () => {
    const { repo } = createFormRepo({ failSave: true })
    const { openSpy } = renderForm(repo)

    await submitValidForm()

    await waitFor(() =>
      expect(screen.getByText(/no se pudo guardar el pedido/i)).toBeTruthy()
    )
    expect(openSpy).not.toHaveBeenCalled()
  })
})