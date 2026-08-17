import type {
  Modifier,
  Product,
  Restaurant,
  RestaurantConfig,
  RestaurantPalette,
} from "@/lib/domain"

/** Default restaurant config seeded on first load (matches current hardcoded values). */
export const DEFAULT_CONFIG: RestaurantConfig = {
  name: "BURGER PAGE",
  whatsapp: "573022575805",
  logo: "/logo.jpg",
  accent: "#FF7A21",
  adminPassword: "admin",
}

/** Default palette matching the current `:root` CSS defaults (TH-1 tokens). */
export const DEFAULT_PALETTE: RestaurantPalette = {
  accent: DEFAULT_CONFIG.accent,
  primary: DEFAULT_CONFIG.accent,
  background: "#0F1112",
  surface: "#181A1B",
}

/** Super-admin password seeded into the v2 envelope (SA-1). */
export const DEFAULT_SUPER_ADMIN_PASSWORD = "superadmin"

/** Seed menu (previously `hamburguesas`). Menu content unchanged. */
export const initialProducts: Product[] = [
  {
    id: "p1",
    name: "Misisipi",
    src: "https://content-cocina.lecturas.com/medio/2021/12/17/recetas-de-hamburguesas-cocineros_9cfe156f_1200x1200.jpg",
    price: 27000,
    description:
      "La Misisipi Burger es una oda a los sabores robustos y la rica herencia culinaria del sur de Estados Unidos.",
    available: true,
  },
  {
    id: "p2",
    name: "La Pollo",
    src: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80",
    price: 22900,
    description:
      "La deliciosa hamburguesa 'La Pollo' es una creación única de nuestra casa,te hará regresar por más.",
    available: true,
  },
  {
    id: "p3",
    name: "Cangreburger",
    src: "https://d1ralsognjng37.cloudfront.net/b219efa7-5c20-4eab-9426-2cda449a4b6b.jpeg",
    price: 27900,
    description:
      "La exquisita Cangreburger es la joya de nuestra carta, una creación marina que despierta tus sentidos con cada bocado.",
    available: true,
  },
  {
    id: "p4",
    name: "La Chichona",
    src: "https://tb-static.uber.com/prod/image-proc/processed_images/32fdcd0acffcd1d410575aa21e29c7cb/719c6bd2757b08684c0faae44d43159d.jpeg",
    price: 25000,
    description:
      "La Chichona es una hamburguesa que se ha ganado su lugar en el corazón de nuestros comensales.",
    available: true,
  },
  {
    id: "p5",
    name: "MegaBurger",
    src: "https://img.restaurantguru.com/rb45-Shark-Burgers-Playa-del-Carmen-Av-115-burger-2022-09-11.jpg",
    price: 27000,
    description:
      "La MegaBurger es un coloso culinario, una auténtica maravilla para los amantes de las hamburguesas.",
    available: true,
  },
]

/** Seed modifiers (previously ADICIONES_INICIALES in Additions.tsx). Content unchanged. */
export const initialModifiers: Modifier[] = [
  {
    id: "m1",
    name: "papas fritas",
    price: 5000,
    src: "https://express.donangelo.pe/wp-content/uploads/2022/05/WhatsApp-Image-2022-05-28-at-10.47.42-AM-10.jpeg",
    available: true,
  },
  {
    id: "m2",
    name: "Cebolla Caramelizada",
    price: 1500,
    src: "https://www.divinacocina.es/wp-content/uploads/cebolla-caramelizada7.jpg",
    available: true,
  },
  {
    id: "m3",
    name: "Extra queso",
    price: 2700,
    src: "https://www.los-almendros.com.ar/shop/wp-content/uploads/ofertaa-queso-raclette-fermier-env-sin-cargo-cap-fed-D_NQ_NP_963843-MLA27191786169_042018-F.jpg",
    available: true,
  },
  {
    id: "m4",
    name: "Tocineta",
    price: 2500,
    src: "https://tienda.atlantic.la/cdn/shop/files/TOCINETAPREMIUM_1024x.jpg?v=1684335896",
    available: true,
  },
]

/**
 * Seed restaurants for the v2 envelope (RD-1: the directory lists them).
 * The first restaurant carries the current single-tenant data; the others
 * are minimal but valid tenants with their own palette and menu.
 */
export const SEED_RESTAURANTS: Restaurant[] = [
  {
    id: "rest-burger-page",
    slug: "burger-page",
    config: DEFAULT_CONFIG,
    palette: DEFAULT_PALETTE,
    products: initialProducts,
    modifiers: initialModifiers,
    orders: [],
  },
  {
    id: "rest-pizza-roma",
    slug: "pizza-roma",
    config: {
      name: "PIZZA ROMA",
      whatsapp: "573001234567",
      logo: "/logo-roma.png",
      accent: "#E63946",
      adminPassword: "roma",
    },
    palette: {
      accent: "#E63946",
      primary: "#E63946",
      background: "#0F1112",
      surface: "#181A1B",
    },
    products: [
      {
        id: "r1",
        name: "Pizza Margherita",
        src: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
        price: 32000,
        description:
          "Salsa de tomate, mozzarella fresca y albahaca sobre masa artesanal.",
        available: true,
      },
      {
        id: "r2",
        name: "Pizza Pepperoni",
        src: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80",
        price: 36000,
        description:
          "Doble capa de pepperoni y queso fundido con borde dorado.",
        available: true,
      },
      {
        id: "r3",
        name: "Pizza Vegetariana",
        src: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800&q=80",
        price: 34000,
        description:
          "Pimientos, champiñones, cebolla morada y aceitunas negras.",
        available: true,
      },
    ],
    modifiers: [],
    orders: [],
  },
  {
    id: "rest-sushi-tokio",
    slug: "sushi-tokio",
    config: {
      name: "SUSHI TOKIO",
      whatsapp: "573009876543",
      logo: "/logo-tokio.png",
      accent: "#2A9D8F",
      adminPassword: "tokio",
    },
    palette: {
      accent: "#2A9D8F",
      primary: "#2A9D8F",
      background: "#0F1112",
      surface: "#181A1B",
    },
    products: [
      {
        id: "s1",
        name: "California Roll",
        src: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80",
        price: 28000,
        description:
          "Cangrejo, aguacate y pepino envueltos en arroz y alga nori.",
        available: true,
      },
      {
        id: "s2",
        name: "Salmón Nigiri",
        src: "https://images.unsplash.com/photo-1563612116625-3012372fccce?w=800&q=80",
        price: 24000,
        description:
          "Lámina de salmón fresco sobre bocado de arroz con wasabi.",
        available: true,
      },
      {
        id: "s3",
        name: "Combo Tokio",
        src: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80",
        price: 52000,
        description:
          "Diez piezas variadas: rolls, nigiris y maki de la casa.",
        available: true,
      },
    ],
    modifiers: [],
    orders: [],
  },
]