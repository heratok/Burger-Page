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

      const { rerender } = render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const whatsappInput = screen.getByPlaceholderText("573022575805") as HTMLInputElement
      fireEvent.change(whatsappInput, { target: { value: "573110000000" } })
      expect(setDraft).toHaveBeenCalled()

      // The free-text hours field is gone, replaced by the weekly editor
      expect(screen.queryByPlaceholderText("Mar - Dom: 12:00 PM - 10:30 PM")).toBeNull()
      // DEFAULT_STORE_CONFIG starts open 24/7; switch Monday to custom hours to edit
      fireEvent.click(screen.getByRole("button", { name: "Definir horario para Lunes" }))
      rerender(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)
      fireEvent.change(screen.getByLabelText("Lunes apertura"), { target: { value: "11:00" } })
      expect(draft.schedule.find((r) => r.dayOfWeek === 1)?.open).toBe("11:00")

      const addressInput = screen.getByPlaceholderText("Calle 45 # 22-18") as HTMLInputElement
      fireEvent.change(addressInput, { target: { value: "Carrera 7 # 100-20" } })
      expect(setDraft).toHaveBeenCalled()
    })

    it("toggles the orders pause and changes the timezone", () => {
      let draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const pause = screen.getByRole("switch", { name: "Pausar pedidos" })
      expect(pause.getAttribute("aria-checked")).toBe("false")
      fireEvent.click(pause)
      expect(draft.ordersPaused).toBe(true)

      const tz = screen.getByLabelText("Zona horaria") as HTMLSelectElement
      expect(tz.value).toBe("America/Bogota")
      fireEvent.change(tz, { target: { value: "Europe/Madrid" } })
      expect(draft.timezone).toBe("Europe/Madrid")
    })

    it("keeps an unknown current timezone selectable", () => {
      const draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG, timezone: "Pacific/Auckland" }
      render(<CustomizerBusinessSection draft={draft} setDraft={vi.fn()} />)
      expect((screen.getByLabelText("Zona horaria") as HTMLSelectElement).value).toBe("Pacific/Auckland")
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
      expect(screen.getByRole("tablist", { name: /Secciones del personalizador/i })).toBeDefined()
      expect(screen.getAllByRole("tab")).toHaveLength(6)
      expect(screen.getByRole("tab", { name: /Estilos/i }).getAttribute("aria-selected")).toBe("true")
      expect(screen.getByText("Personalizador Visual de Tienda")).toBeDefined()
      expect(screen.getByText("Estilos Listos en 1 Clic")).toBeDefined()

      // Navigate to "Marca" tab
      const marcaTab = screen.getByRole("tab", { name: /Marca/i })
      fireEvent.click(marcaTab)
      expect(screen.getByText("Identidad Visual & Fotos")).toBeDefined()

      // Navigate to "Colores" tab
      const coloresTab = screen.getByRole("tab", { name: /Colores/i })
      fireEvent.click(coloresTab)
      expect(screen.getByText("Color de Acento de la Tienda")).toBeDefined()

      // Navigate to "Diseño" tab
      const disenoTab = screen.getByRole("tab", { name: /Diseño/i })
      fireEvent.click(disenoTab)
      expect(screen.getByText("Tipografía de la Carta")).toBeDefined()

      // Navigate to "Pedidos" tab
      const pedidosTab = screen.getByRole("tab", { name: /Pedidos/i })
      fireEvent.click(pedidosTab)
      expect(screen.getByText("Información Comercial, Pedidos & Domicilios")).toBeDefined()

      // Navigate to "Mesas" tab
      const mesasTab = screen.getByRole("tab", { name: /Mesas/i })
      fireEvent.click(mesasTab)
      expect(screen.getByText("Mesas del salón")).toBeDefined()
      expect(screen.getByRole("tab", { name: /Mesas/i }).getAttribute("aria-selected")).toBe("true")
      expect(screen.getByRole("tab", { name: /Estilos/i }).getAttribute("aria-selected")).toBe("false")
    })

    describe("WAI-ARIA keyboard navigation for Personalizar tabs", () => {
      it("manages roving tabIndex so only the active tab has tabIndex=0 and others have -1", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const marcaTab = screen.getByRole("tab", { name: /Marca/i })
        const coloresTab = screen.getByRole("tab", { name: /Colores/i })
        const disenoTab = screen.getByRole("tab", { name: /Diseño/i })
        const pedidosTab = screen.getByRole("tab", { name: /Pedidos/i })
        const mesasTab = screen.getByRole("tab", { name: /Mesas/i })

        // Initial state: Estilos is active
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
        expect(marcaTab.getAttribute("tabindex")).toBe("-1")
        expect(coloresTab.getAttribute("tabindex")).toBe("-1")
        expect(disenoTab.getAttribute("tabindex")).toBe("-1")
        expect(pedidosTab.getAttribute("tabindex")).toBe("-1")
        expect(mesasTab.getAttribute("tabindex")).toBe("-1")

        // Switch to Marca tab
        fireEvent.click(marcaTab)
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")
        expect(marcaTab.getAttribute("tabindex")).toBe("0")
        expect(coloresTab.getAttribute("tabindex")).toBe("-1")
      })

      it("navigates forward with ArrowRight, wraps from last to first, and moves focus and selection", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const marcaTab = screen.getByRole("tab", { name: /Marca/i })
        const mesasTab = screen.getByRole("tab", { name: /Mesas/i })

        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // ArrowRight from Estilos -> Marca
        fireEvent.keyDown(estilosTab, { key: "ArrowRight" })
        expect(document.activeElement).toBe(marcaTab)
        expect(marcaTab.getAttribute("aria-selected")).toBe("true")
        expect(marcaTab.getAttribute("tabindex")).toBe("0")
        expect(estilosTab.getAttribute("aria-selected")).toBe("false")
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")

        // Jump to last tab (Mesas)
        fireEvent.click(mesasTab)
        mesasTab.focus()
        expect(document.activeElement).toBe(mesasTab)

        // ArrowRight wraps to Estilos
        fireEvent.keyDown(mesasTab, { key: "ArrowRight" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
        expect(mesasTab.getAttribute("aria-selected")).toBe("false")
        expect(mesasTab.getAttribute("tabindex")).toBe("-1")
      })

      it("navigates backward with ArrowLeft, wraps from first to last, and moves focus and selection", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const pedidosTab = screen.getByRole("tab", { name: /Pedidos/i })
        const mesasTab = screen.getByRole("tab", { name: /Mesas/i })

        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // ArrowLeft from first tab (Estilos) wraps to last tab (Mesas)
        fireEvent.keyDown(estilosTab, { key: "ArrowLeft" })
        expect(document.activeElement).toBe(mesasTab)
        expect(mesasTab.getAttribute("aria-selected")).toBe("true")
        expect(mesasTab.getAttribute("tabindex")).toBe("0")
        expect(estilosTab.getAttribute("aria-selected")).toBe("false")
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")

        // ArrowLeft from Mesas moves to Pedidos
        fireEvent.keyDown(mesasTab, { key: "ArrowLeft" })
        expect(document.activeElement).toBe(pedidosTab)
        expect(pedidosTab.getAttribute("aria-selected")).toBe("true")
        expect(pedidosTab.getAttribute("tabindex")).toBe("0")
      })

      it("jumps to first with Home and last with End, moving focus and selection", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const coloresTab = screen.getByRole("tab", { name: /Colores/i })
        const mesasTab = screen.getByRole("tab", { name: /Mesas/i })

        fireEvent.click(coloresTab)
        coloresTab.focus()
        expect(document.activeElement).toBe(coloresTab)

        // End moves to last tab (Mesas)
        fireEvent.keyDown(coloresTab, { key: "End" })
        expect(document.activeElement).toBe(mesasTab)
        expect(mesasTab.getAttribute("aria-selected")).toBe("true")
        expect(mesasTab.getAttribute("tabindex")).toBe("0")

        // Home moves to first tab (Estilos)
        fireEvent.keyDown(mesasTab, { key: "Home" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
      })

      it("navigates vertically within the same column with ArrowDown and ArrowUp and wraps within column", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i }) // col 0, row 0 (index 0)
        const marcaTab = screen.getByRole("tab", { name: /Marca/i })     // col 1, row 0 (index 1)
        const coloresTab = screen.getByRole("tab", { name: /Colores/i }) // col 2, row 0 (index 2)
        const disenoTab = screen.getByRole("tab", { name: /Diseño/i })   // col 0, row 1 (index 3)
        const pedidosTab = screen.getByRole("tab", { name: /Pedidos/i }) // col 1, row 1 (index 4)
        const mesasTab = screen.getByRole("tab", { name: /Mesas/i })     // col 2, row 1 (index 5)

        // --- Column 0: Estilos (0) <-> Diseño (3) ---
        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // Down from Estilos -> Diseño
        fireEvent.keyDown(estilosTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(disenoTab)
        expect(disenoTab.getAttribute("aria-selected")).toBe("true")
        expect(disenoTab.getAttribute("tabindex")).toBe("0")
        expect(estilosTab.getAttribute("aria-selected")).toBe("false")
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")

        // Down from bottom row (Diseño) wraps to top of column (Estilos)
        fireEvent.keyDown(disenoTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")

        // Up from top row (Estilos) wraps to bottom of column (Diseño)
        fireEvent.keyDown(estilosTab, { key: "ArrowUp" })
        expect(document.activeElement).toBe(disenoTab)
        expect(disenoTab.getAttribute("aria-selected")).toBe("true")

        // Up from Diseño -> Estilos
        fireEvent.keyDown(disenoTab, { key: "ArrowUp" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")

        // --- Column 1: Marca (1) <-> Pedidos (4) ---
        fireEvent.click(marcaTab)
        marcaTab.focus()
        expect(document.activeElement).toBe(marcaTab)

        // Down from Marca -> Pedidos
        fireEvent.keyDown(marcaTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(pedidosTab)
        expect(pedidosTab.getAttribute("aria-selected")).toBe("true")

        // Down from Pedidos wraps to Marca
        fireEvent.keyDown(pedidosTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(marcaTab)
        expect(marcaTab.getAttribute("aria-selected")).toBe("true")

        // Up from Marca wraps to Pedidos
        fireEvent.keyDown(marcaTab, { key: "ArrowUp" })
        expect(document.activeElement).toBe(pedidosTab)
        expect(pedidosTab.getAttribute("aria-selected")).toBe("true")

        // --- Column 2: Colores (2) <-> Mesas (5) ---
        fireEvent.click(coloresTab)
        coloresTab.focus()
        expect(document.activeElement).toBe(coloresTab)

        // Down from Colores -> Mesas
        fireEvent.keyDown(coloresTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(mesasTab)
        expect(mesasTab.getAttribute("aria-selected")).toBe("true")

        // Down from Mesas wraps to Colores
        fireEvent.keyDown(mesasTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(coloresTab)
        expect(coloresTab.getAttribute("aria-selected")).toBe("true")

        // Up from Colores wraps to Mesas
        fireEvent.keyDown(coloresTab, { key: "ArrowUp" })
        expect(document.activeElement).toBe(mesasTab)
        expect(mesasTab.getAttribute("aria-selected")).toBe("true")
      })

      it("calls preventDefault on handled keys and leaves other keys untouched", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        estilosTab.focus()

        // Handled keys should have defaultPrevented = true
        for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"]) {
          const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
          fireEvent(estilosTab, event)
          expect(event.defaultPrevented).toBe(true)
        }

        // Unhandled keys should NOT have defaultPrevented
        for (const key of ["Tab", "Enter", "Space", "KeyA"]) {
          const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
          fireEvent(estilosTab, event)
          expect(event.defaultPrevented).toBe(false)
        }
      })
    })
  })
})
