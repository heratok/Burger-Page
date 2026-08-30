import type {
  RestaurantRecord,
  StorageEnvelopeV2,
  MenuItem,
  AdditionItem,
  Order,
  Customer,
  InventoryItem,
  Supplier,
} from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/data/initialData"

export const TEST_PRODUCTS: MenuItem[] = [
  {
    id: "prod-1",
    name: "Burger Doble Queso",
    price: 25000,
    category: "Clásicas",
    src: "",
    description: "Doble carne, queso cheddar y tocineta",
    inStock: true,
    isPopular: true,
  },
  {
    id: "prod-2",
    name: "Papas Rústicas",
    price: 9000,
    category: "Acompañamientos",
    src: "",
    description: "Papas en gajos con paprika",
    inStock: true,
  },
]

export const TEST_ADDITIONS: AdditionItem[] = [
  { id: "add-1", name: "Extra Queso", price: 3000, available: true },
  { id: "add-2", name: "Tocineta Extra", price: 4000, available: true },
]

export const TEST_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    nombre: "Santiago Restrepo",
    telefono: "3109876543",
    direccion: "Carrera 15 # 88-21",
    barrio: "Chicó",
    totalOrders: 3,
    totalSpent: 84000,
    lastOrderDate: "2026-08-28T14:30:00.000Z",
    loyaltyTier: "silver",
  },
]

export const TEST_ORDERS: Order[] = [
  {
    id: "ord-1",
    orderNumber: 1001,
    customer: {
      nombre: "Santiago Restrepo",
      telefono: "3109876543",
      direccion: "Carrera 15 # 88-21",
      barrio: "Chicó",
    },
    items: [
      {
        name: "Burger Doble Queso",
        price: 25000,
        cantidad: 1,
        total: 25000,
      },
    ],
    total: 25000,
    deliveryFee: 5000,
    finalTotal: 30000,
    metodo: "Efectivo",
    status: "pending",
    createdAt: "2026-08-28T16:00:00.000Z",
    updatedAt: "2026-08-28T16:00:00.000Z",
  },
]

export const TEST_INVENTORY: InventoryItem[] = [
  {
    id: "inv-1",
    name: "Carne de Res 180g",
    category: "ingredients",
    currentStock: 40,
    minStockAlert: 10,
    unit: "unidades",
    costPerUnit: 6500,
    supplierId: "sup-1",
    lastRestockedAt: "2026-08-20T08:00:00.000Z",
  },
]

export const TEST_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Carnes Premium",
    category: "Carnes",
    contactName: "Mauricio Restrepo",
    phone: "573112233445",
    email: "mauricio@premium.com",
    notes: "Entrega cortes madurados al vacío los martes y jueves",
  },
]

export const TEST_RESTAURANTS: RestaurantRecord[] = [
  {
    id: "rest-burger-craft",
    slug: "burger-craft",
    adminPassword: "craft",
    isActive: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    config: {
      ...DEFAULT_STORE_CONFIG,
      name: "Burger Craft",
      tagline: "Hamburguesas artesanales",
      primaryColor: "#FF7A21",
    },
    categories: ["Clásicas", "Acompañamientos", "Bebidas"],
    products: TEST_PRODUCTS,
    additions: TEST_ADDITIONS,
    inventory: TEST_INVENTORY,
    suppliers: TEST_SUPPLIERS,
    orders: TEST_ORDERS,
    customers: TEST_CUSTOMERS,
  },
  {
    id: "rest-pizzeria-napoli",
    slug: "pizzeria-napoli",
    adminPassword: "napoli",
    isActive: true,
    createdAt: "2026-08-05T15:00:00.000Z",
    config: {
      ...DEFAULT_STORE_CONFIG,
      name: "Pizzería Di Napoli",
      tagline: "Pizza napolitana",
      primaryColor: "#E63946",
    },
    categories: ["Pizzas", "Bebidas"],
    products: [
      {
        id: "piz-1",
        name: "Pizza Margherita",
        price: 34000,
        category: "Pizzas",
        src: "",
        description: "Pizza clásica",
        inStock: true,
      },
    ],
    additions: [],
    inventory: [],
    suppliers: [],
    orders: [],
    customers: [],
  },
  {
    id: "rest-tacos-el-rey",
    slug: "tacos-el-rey",
    adminPassword: "tacos",
    isActive: true,
    createdAt: "2026-08-10T10:00:00.000Z",
    config: {
      ...DEFAULT_STORE_CONFIG,
      name: "Tacos El Rey",
      tagline: "Taquería urbana",
    },
    categories: ["Tacos"],
    products: [
      {
        id: "tac-1",
        name: "Tacos al Pastor",
        price: 21000,
        category: "Tacos",
        src: "",
        description: "Tacos de cerdo",
        inStock: true,
      },
    ],
    additions: [],
    inventory: [],
    suppliers: [],
    orders: [],
    customers: [],
  },
  {
    id: "rest-rosto",
    slug: "rosto",
    adminPassword: "rosto",
    isActive: true,
    createdAt: "2026-08-15T12:00:00.000Z",
    config: {
      ...DEFAULT_STORE_CONFIG,
      name: "Rosto",
      tagline: "Sabor artesanal",
    },
    categories: ["Hamburguesas", "Parrilla"],
    products: TEST_PRODUCTS,
    additions: TEST_ADDITIONS,
    inventory: TEST_INVENTORY,
    suppliers: TEST_SUPPLIERS,
    orders: TEST_ORDERS,
    customers: TEST_CUSTOMERS,
  },
]

export const TEST_STORAGE_ENVELOPE: StorageEnvelopeV2 = {
  version: 2,
  superAdminPassword: "admin",
  restaurants: TEST_RESTAURANTS,
}
