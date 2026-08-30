import type { StorefrontConfig } from "@/types/restaurant"

export const DEFAULT_STORE_CONFIG: StorefrontConfig = {
  name: "Mi Restaurante",
  tagline: "Sabor auténtico en cada pedido",
  logoUrl: "",
  bannerUrl: "",
  showBanner: false,
  announcementText: "¡Bienvenidos a nuestra tienda online! Haz tu pedido directamente por WhatsApp.",
  showAnnouncement: true,
  whatsappNumber: "",
  currency: "COP",
  currencySymbol: "$",
  deliveryFee: 5000,
  minOrderAmount: 20000,
  estimatedDeliveryTime: "30 - 45 min",
  openingHours: "12:00 - 22:30",
  address: "",

  // Theme & UI/UX Customization
  primaryColor: "#E63946",
  primaryHoverColor: "#F25C69",
  bgTheme: "dark-charcoal",
  fontFamily: "sans",
  cardRadius: "md",
  cardStyle: "elevated",
  compactGrid: false,
  showBadges: true,
}

export const THEME_COLOR_PRESETS = [
  {
    id: "orange-craft",
    name: "Fuego Naranja",
    primary: "#FF7A21",
    primaryHover: "#FF8F3F",
    description: "Cálido, apetitoso y moderno",
  },
  {
    id: "red-gourmet",
    name: "Rojo Gourmet",
    primary: "#E63946",
    primaryHover: "#F25C69",
    description: "Energético, clásico de parrilla",
  },
  {
    id: "emerald-fresh",
    name: "Esmeralda Fresh",
    primary: "#10B981",
    primaryHover: "#34D399",
    description: "Fresco, orgánico y artesanal",
  },
  {
    id: "purple-premium",
    name: "Púrpura Premium",
    primary: "#8B5CF6",
    primaryHover: "#A78BFA",
    description: "Exclusivo, vanguardista y de autor",
  },
  {
    id: "amber-gold",
    name: "Ámbar Dorado",
    primary: "#F59E0B",
    primaryHover: "#FBBF24",
    description: "Dorado tostado de pan y queso cheddar",
  },
  {
    id: "blue-bistro",
    name: "Azul Bistro",
    primary: "#3B82F6",
    primaryHover: "#60A5FA",
    description: "Elegante, sobrio y contemporáneo",
  },
]

export const BG_THEME_OPTIONS = [
  {
    id: "dark-charcoal",
    name: "Carbón Oscuro",
    description: "Ambiente nocturno con alto contraste",
    previewColor: "#0F1112",
  },
  {
    id: "deep-midnight",
    name: "Medianoche Profundo",
    description: "Negro absoluto para resaltar los colores",
    previewColor: "#050607",
  },
  {
    id: "warm-cream",
    name: "Crema & Arena",
    description: "Cálido, artesanal y orgánico",
    previewColor: "#FAF7F2",
  },
  {
    id: "clean-white",
    name: "Blanco Puro",
    description: "Limpio, minimalista y luminoso",
    previewColor: "#FFFFFF",
  },
]

export const FONT_FAMILY_OPTIONS = [
  {
    id: "sans",
    name: "Sans Moderna (Plus Jakarta)",
    preview: "Aa Bb Cc 123",
    description: "Limpia, geométrica y de máxima legibilidad móvil",
  },
  {
    id: "serif",
    name: "Serif Elegante (Playfair)",
    preview: "Aa Bb Cc 123",
    description: "Sofisticada para bistrós, pastas y carnes premium",
  },
  {
    id: "mono",
    name: "Mono Street (JetBrains)",
    preview: "Aa Bb Cc 123",
    description: "Estilo urbano, callejero y contemporary grill",
  },
  {
    id: "display",
    name: "Display Brutalist (Clash)",
    preview: "Aa Bb Cc 123",
    description: "Titulares contundentes para smash burgers y tacos",
  },
]

export const CARD_STYLE_OPTIONS = [
  {
    id: "elevated",
    name: "Elevada con Sombra",
    description: "Sombra suave con profundidad tridimensional moderna",
  },
  {
    id: "bordered",
    name: "Borde Definido",
    description: "Líneas nítidas de 1px para diseño estructurado y limpio",
  },
  {
    id: "glass",
    name: "Efecto Glassmorphism",
    description: "Translucidez con desenfoque de fondo premium",
  },
  {
    id: "minimal",
    name: "Minimalista Plana",
    description: "Sin bordes ni sombras pesadas, foco 100% en la fotografía",
  },
]

export const CARD_RADIUS_OPTIONS = [
  { id: "sm", name: "Leve (8px)", radiusClass: "rounded-lg" },
  { id: "md", name: "Estándar (16px)", radiusClass: "rounded-2xl" },
  { id: "lg", name: "Pronunciado (24px)", radiusClass: "rounded-3xl" },
  { id: "full", name: "Píldora / Suave", radiusClass: "rounded-[28px]" },
]
