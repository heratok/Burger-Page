import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { StorefrontCustomizer } from "./StorefrontCustomizer"
import {
  CustomizerPresetsSection,
  CustomizerBrandingSection,
  CustomizerColorsSection,
  CustomizerLayoutSection,
  CustomizerBusinessSection,
  CustomizerLivePreview,
} from "./customizer"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import type { StorefrontConfig } from "@/types/restaurant"

describe("StorefrontCustomizer & Subcomponents (TDD Modularization)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("CustomizerPresetsSection", () => {
    it("renders 1-click theme presets and applies a chosen template", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerPresetsSection draft={draft} setDraft={setDraft} />)

      expect(screen.getByText("Estilos Listos en 1 Clic")).toBeDefined()
      expect(screen.getByText(/🍔 Hamburguesería Urbana/i)).toBeDefined()
      expect(screen.getByText(/🥩 Parrilla & Bar Dark/i)).toBeDefined()

      // Click on "🥩 Parrilla & Bar Dark"
      const grillPreset = screen.getByText(/🥩 Parrilla & Bar Dark/i)
      fireEvent.click(grillPreset)

      expect(setDraft).toHaveBeenCalled()
    })
  })

  describe("CustomizerBrandingSection", () => {
    it("updates restaurant name, tagline, and announcement text", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG, showAnnouncement: true }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerBrandingSection draft={draft} setDraft={setDraft} />)

      const nameInput = screen.getByPlaceholderText("Ej. Burger Craft") as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: "Burger Queen" } })
      expect(setDraft).toHaveBeenCalled()

      const taglineInput = screen.getByPlaceholderText("Ej. Cocina artesanal con sabor inolvidable") as HTMLInputElement
      fireEvent.change(taglineInput, { target: { value: "Las mejores smash" } })
      expect(setDraft).toHaveBeenCalled()

      const announcementInput = screen.getByPlaceholderText("🔥 ¡Envío GRATIS hoy...!") as HTMLInputElement
      fireEvent.change(announcementInput, { target: { value: "2x1 todos los martes" } })
      expect(setDraft).toHaveBeenCalled()
    })
  })

  describe("CustomizerColorsSection", () => {
    it("allows selecting preset accent colors and store background themes", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerColorsSection draft={draft} setDraft={setDraft} />)

      expect(screen.getByText("Color de Acento de la Tienda")).toBeDefined()
      expect(screen.getByText("Fondo & Atmósfera")).toBeDefined()

      // Click preset color (e.g., Fuego Naranja)
      const orangeBtn = screen.getByText(/Fuego Naranja/i)
      fireEvent.click(orangeBtn)
      expect(setDraft).toHaveBeenCalled()

      // Click Clean White bg theme
      const whiteBgBtn = screen.getByText("Blanco Puro")
      fireEvent.click(whiteBgBtn)
      expect(setDraft).toHaveBeenCalled()
    })
  })

  describe("CustomizerLayoutSection", () => {
    it("allows changing font family, card style, and border radius", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerLayoutSection draft={draft} setDraft={setDraft} />)

      // Change font family to Serif
      const serifBtn = screen.getByText("Elegante (Serif)")
      fireEvent.click(serifBtn)
      expect(setDraft).toHaveBeenCalled()

      // Change card style to Glass
      const glassBtn = screen.getByText("Cristal Glassmorphism")
      fireEvent.click(glassBtn)
      expect(setDraft).toHaveBeenCalled()

      // Change border radius to Full
      const fullRadiusBtn = screen.getByText("24px Píldora")
      fireEvent.click(fullRadiusBtn)
      expect(setDraft).toHaveBeenCalled()
    })
  })

  describe("CustomizerBusinessSection", () => {
    it("updates delivery fee, min order amount, opening hours, and address", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const whatsappInput = screen.getByPlaceholderText("573022575805") as HTMLInputElement
      fireEvent.change(whatsappInput, { target: { value: "573110000000" } })
      expect(setDraft).toHaveBeenCalled()

      const scheduleInput = screen.getByPlaceholderText("Mar - Dom: 12:00 PM - 10:30 PM") as HTMLInputElement
      fireEvent.change(scheduleInput, { target: { value: "Lun - Sab: 11:00 AM - 11:00 PM" } })
      expect(setDraft).toHaveBeenCalled()

      const addressInput = screen.getByPlaceholderText("Calle 45 # 22-18") as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: "Carrera 7 # 100-20" } })
      expect(setDraft).toHaveBeenCalled()
    })
  })

  describe("CustomizerLivePreview", () => {
    it("renders live preview mockup and toggles between desktop and mobile views", () => {
      const setPreviewDevice = vi.fn()
      const onViewRealStore = vi.fn()

      render(
        <CustomizerLivePreview
          draft={DEFAULT_STORE_CONFIG}
          previewDevice="desktop"
          setPreviewDevice={setPreviewDevice}
          products={[
            {
              id: "1",
              name: "Burger Doble Carne",
              price: 25000,
              category: "Burgers",
              src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
              description: "Doble carne jugosa",
              inStock: true,
              isPopular: true,
            },
          ]}
          onViewRealStore={onViewRealStore}
        />
      )

      expect(screen.getByText("Simulador en Tiempo Real")).toBeDefined()
      expect(screen.getByText("Burger Doble Carne")).toBeDefined()
      expect(screen.getByText("Popular")).toBeDefined()

      // Switch to mobile device view
      const mobileBtn = screen.getByTitle("Vista Móvil")
      fireEvent.click(mobileBtn)
      expect(setPreviewDevice).toHaveBeenCalledWith("mobile")

      // Click "Ver Tienda Real"
      const viewRealStoreBtn = screen.getByText("Ver Tienda Real")
      fireEvent.click(viewRealStoreBtn)
      expect(onViewRealStore).toHaveBeenCalledTimes(1)
    })
  })

  describe("StorefrontCustomizer Container Component", () => {
    it("renders header and navigates through all 5 sections seamlessly", () => {
      render(
        <RestaurantProvider>
          <StorefrontCustomizer />
        </RestaurantProvider>
      )

      // Initial active tab: Estilos (templates)
      expect(screen.getByText("Personalizador Visual de Tienda")).toBeDefined()
      expect(screen.getByText("Estilos Listos en 1 Clic")).toBeDefined()

      // Navigate to "Marca" tab
      const marcaTab = screen.getByRole("button", { name: /Marca/i })
      fireEvent.click(marcaTab)
      expect(screen.getByText("Identidad Visual & Fotos")).toBeDefined()

      // Navigate to "Colores" tab
      const coloresTab = screen.getByRole("button", { name: /Colores/i })
      fireEvent.click(coloresTab)
      expect(screen.getByText("Color de Acento de la Tienda")).toBeDefined()

      // Navigate to "Diseño" tab
      const disenoTab = screen.getByRole("button", { name: /Diseño/i })
      fireEvent.click(disenoTab)
      expect(screen.getByText("Tipografía de la Carta")).toBeDefined()

      // Navigate to "Pedidos" tab
      const pedidosTab = screen.getByRole("button", { name: /Pedidos/i })
      fireEvent.click(pedidosTab)
      expect(screen.getByText("Información Comercial, Pedidos & Domicilios")).toBeDefined()
    })
  })
})
