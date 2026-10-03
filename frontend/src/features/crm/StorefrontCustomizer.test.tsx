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

      const whatsappInput = screen.getByLabelText("Número de WhatsApp local") as HTMLInputElement
      fireEvent.change(whatsappInput, { target: { value: "3110000000" } })
      expect(setDraft).toHaveBeenCalled()

      // The free-text hours field is gone, replaced by the weekly editor
      expect(screen.queryByPlaceholderText("Mar - Dom: 12:00 PM - 10:30 PM")).toBeNull()

      // Expand the schedule accordion
      fireEvent.click(screen.getByRole("button", { name: /Horario de Atención & Zona/i }))

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

      // Open schedule accordion for timezone
      fireEvent.click(screen.getByRole("button", { name: /Horario de Atención & Zona/i }))
      const tz = screen.getByLabelText("Zona horaria") as HTMLSelectElement
      expect(tz.value).toBe("America/Bogota")
      fireEvent.change(tz, { target: { value: "Europe/Madrid" } })
      expect(draft.timezone).toBe("Europe/Madrid")
    })

    it("keeps an unknown current timezone selectable", () => {
      const draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG, timezone: "Pacific/Auckland" }
      render(<CustomizerBusinessSection draft={draft} setDraft={vi.fn()} />)
      fireEvent.click(screen.getByRole("button", { name: /Horario de Atención & Zona/i }))
      expect((screen.getByLabelText("Zona horaria") as HTMLSelectElement).value).toBe("Pacific/Auckland")
    })

    it("allows expanding and collapsing all accordion sections", () => {
      const draft: StorefrontConfig = { ...DEFAULT_STORE_CONFIG }
      render(<CustomizerBusinessSection draft={draft} setDraft={vi.fn()} />)

      // Initially schedule is closed
      expect(screen.queryByLabelText("Zona horaria")).toBeNull()

      // Click "Expandir todo"
      const toggleAllBtn = screen.getByRole("button", { name: "Expandir todo" })
      fireEvent.click(toggleAllBtn)

      // Now schedule is open
      expect(screen.getByLabelText("Zona horaria")).toBeDefined()
      expect(screen.getByLabelText("Número de WhatsApp local")).toBeDefined()

      // Click "Colapsar todo"
      fireEvent.click(screen.getByRole("button", { name: "Colapsar todo" }))
      expect(screen.queryByLabelText("Zona horaria")).toBeNull()
      expect(screen.queryByLabelText("Número de WhatsApp local")).toBeNull()
    })

    it("updates draft.whatsappNumber when selecting a different country dial code", () => {
      let draft: StorefrontConfig = {
        ...DEFAULT_STORE_CONFIG,
        whatsappNumber: "573022575805",
      }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      const { rerender } = render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const countrySelect = screen.getByLabelText("Indicativo de país") as HTMLSelectElement
      expect(countrySelect.value).toBe("57")

      // Change country to México (+52)
      fireEvent.change(countrySelect, { target: { value: "52" } })
      expect(setDraft).toHaveBeenCalled()
      expect(draft.whatsappNumber).toBe("523022575805")

      rerender(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)
      expect(screen.getAllByText("+523022575805").length).toBeGreaterThan(0)
    })

    it("updates draft.currency and draft.currencySymbol when changing currency dropdown", () => {
      let draft: StorefrontConfig = {
        ...DEFAULT_STORE_CONFIG,
        currency: "COP",
        currencySymbol: "$",
      }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      const { rerender } = render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const currencySelect = screen.getByLabelText("Moneda") as HTMLSelectElement
      expect(currencySelect.value).toBe("COP")

      // Change currency to EUR
      fireEvent.change(currencySelect, { target: { value: "EUR" } })
      expect(setDraft).toHaveBeenCalled()
      expect(draft.currency).toBe("EUR")
      expect(draft.currencySymbol).toBe("€")

      rerender(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      // Test custom symbol override
      const symbolInput = screen.getByLabelText("Símbolo de moneda") as HTMLInputElement
      expect(symbolInput.value).toBe("€")
      fireEvent.change(symbolInput, { target: { value: "EUR€" } })
      expect(setDraft).toHaveBeenCalled()
      expect(draft.currencySymbol).toBe("EUR€")
    })

    it("updates draft.estimatedDeliveryTime when clicking a delivery time pill", () => {
      let draft: StorefrontConfig = {
        ...DEFAULT_STORE_CONFIG,
        estimatedDeliveryTime: "30 - 45 min",
      }
      const setDraft = vi.fn((updater) => {
        draft = typeof updater === "function" ? updater(draft) : updater
      })

      render(<CustomizerBusinessSection draft={draft} setDraft={setDraft} />)

      const pill1530 = screen.getByRole("button", { name: "15 - 30 min" })
      fireEvent.click(pill1530)
      expect(setDraft).toHaveBeenCalled()
      expect(draft.estimatedDeliveryTime).toBe("15 - 30 min")

      const pill60Plus = screen.getByRole("button", { name: "60+ min" })
      fireEvent.click(pill60Plus)
      expect(setDraft).toHaveBeenCalled()
      expect(draft.estimatedDeliveryTime).toBe("60+ min")
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
    it("renders header and navigates through all 4 visual sections seamlessly", () => {
      render(
        <RestaurantProvider>
          <StorefrontCustomizer />
        </RestaurantProvider>
      )

      // Initial active tab: Estilos (templates)
      expect(screen.getByRole("tablist", { name: /Secciones del personalizador/i })).toBeDefined()
      expect(screen.getAllByRole("tab")).toHaveLength(4)
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
      expect(screen.getByRole("tab", { name: /Diseño/i }).getAttribute("aria-selected")).toBe("true")
      expect(screen.getByRole("tab", { name: /Estilos/i }).getAttribute("aria-selected")).toBe("false")

      // Decoupled operational modules should NOT exist in visual customizer tabs
      expect(screen.queryByRole("tab", { name: /Pedidos/i })).toBeNull()
      expect(screen.queryByRole("tab", { name: /Mesas/i })).toBeNull()
    })

    it("derives tablist gridTemplateColumns style from TAB_COLUMNS constant and sets repeat(4, ...)", () => {
      render(
        <RestaurantProvider>
          <StorefrontCustomizer />
        </RestaurantProvider>
      )

      const tablist = screen.getByRole("tablist", { name: /Secciones del personalizador/i })
      expect(tablist.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))")
      expect(tablist.className).not.toContain("grid-cols-3")
      expect(tablist.className).toContain("grid")
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

        // Initial state: Estilos is active
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
        expect(marcaTab.getAttribute("tabindex")).toBe("-1")
        expect(coloresTab.getAttribute("tabindex")).toBe("-1")
        expect(disenoTab.getAttribute("tabindex")).toBe("-1")

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
        const disenoTab = screen.getByRole("tab", { name: /Diseño/i })

        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // ArrowRight from Estilos -> Marca
        fireEvent.keyDown(estilosTab, { key: "ArrowRight" })
        expect(document.activeElement).toBe(marcaTab)
        expect(marcaTab.getAttribute("aria-selected")).toBe("true")
        expect(marcaTab.getAttribute("tabindex")).toBe("0")
        expect(estilosTab.getAttribute("aria-selected")).toBe("false")
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")

        // Jump to last tab (Diseño)
        fireEvent.click(disenoTab)
        disenoTab.focus()
        expect(document.activeElement).toBe(disenoTab)

        // ArrowRight wraps to Estilos
        fireEvent.keyDown(disenoTab, { key: "ArrowRight" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
        expect(disenoTab.getAttribute("aria-selected")).toBe("false")
        expect(disenoTab.getAttribute("tabindex")).toBe("-1")
      })

      it("navigates backward with ArrowLeft, wraps from first to last, and moves focus and selection", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const coloresTab = screen.getByRole("tab", { name: /Colores/i })
        const disenoTab = screen.getByRole("tab", { name: /Diseño/i })

        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // ArrowLeft from first tab (Estilos) wraps to last tab (Diseño)
        fireEvent.keyDown(estilosTab, { key: "ArrowLeft" })
        expect(document.activeElement).toBe(disenoTab)
        expect(disenoTab.getAttribute("aria-selected")).toBe("true")
        expect(disenoTab.getAttribute("tabindex")).toBe("0")
        expect(estilosTab.getAttribute("aria-selected")).toBe("false")
        expect(estilosTab.getAttribute("tabindex")).toBe("-1")

        // ArrowLeft from Diseño moves to Colores
        fireEvent.keyDown(disenoTab, { key: "ArrowLeft" })
        expect(document.activeElement).toBe(coloresTab)
        expect(coloresTab.getAttribute("aria-selected")).toBe("true")
        expect(coloresTab.getAttribute("tabindex")).toBe("0")
      })

      it("jumps to first with Home and last with End, moving focus and selection", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const coloresTab = screen.getByRole("tab", { name: /Colores/i })
        const disenoTab = screen.getByRole("tab", { name: /Diseño/i })

        fireEvent.click(coloresTab)
        coloresTab.focus()
        expect(document.activeElement).toBe(coloresTab)

        // End moves to last tab (Diseño)
        fireEvent.keyDown(coloresTab, { key: "End" })
        expect(document.activeElement).toBe(disenoTab)
        expect(disenoTab.getAttribute("aria-selected")).toBe("true")
        expect(disenoTab.getAttribute("tabindex")).toBe("0")

        // Home moves to first tab (Estilos)
        fireEvent.keyDown(disenoTab, { key: "Home" })
        expect(document.activeElement).toBe(estilosTab)
        expect(estilosTab.getAttribute("aria-selected")).toBe("true")
        expect(estilosTab.getAttribute("tabindex")).toBe("0")
      })

      it("navigates vertically with ArrowDown and ArrowUp wrapping within column", () => {
        render(
          <RestaurantProvider>
            <StorefrontCustomizer />
          </RestaurantProvider>
        )

        const estilosTab = screen.getByRole("tab", { name: /Estilos/i })
        const marcaTab = screen.getByRole("tab", { name: /Marca/i })

        estilosTab.focus()
        expect(document.activeElement).toBe(estilosTab)

        // With 1 row (4 items in 4 columns), Down/Up wraps to same column
        fireEvent.keyDown(estilosTab, { key: "ArrowDown" })
        expect(document.activeElement).toBe(estilosTab)

        fireEvent.click(marcaTab)
        marcaTab.focus()
        fireEvent.keyDown(marcaTab, { key: "ArrowUp" })
        expect(document.activeElement).toBe(marcaTab)
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
