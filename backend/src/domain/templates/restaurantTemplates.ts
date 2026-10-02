import { DEFAULT_CURRENCY } from '../shared/currency.js';

/**
 * Data-only definitions of the restaurant templates a super admin can pick when
 * creating a tenant. Adding a template is adding an entry to RESTAURANT_TEMPLATES
 * (and its id to the `templateType` enum of the contracts package): the create
 * use case and GET /restaurants/templates are generated from this data.
 *
 * Prices are written in whole COP (the platform default). They are scaled to the
 * restaurant's currency at seeding time by scaleTemplatePrice. Menu content is
 * Spanish because it is customer-facing sample data for LatAm restaurants. No
 * image is declared on purpose: the storefront renders products without one, and
 * an external URL could break.
 */

export interface TemplateProduct {
  name: string;
  description: string;
  /** Whole COP; scaled to the restaurant currency when seeded. */
  price: number;
  /** Must be one of the template's `categories`. */
  category: string;
  isPopular?: boolean;
  isNew?: boolean;
  preparationTimeMinutes?: number;
}

/** Additions are restaurant-wide (no productId), like the extras the storefront offers on any dish. */
export interface TemplateAddition {
  name: string;
  /** Whole COP; scaled to the restaurant currency when seeded. */
  price: number;
}

export interface RestaurantTemplate {
  id: 'burger' | 'pizza' | 'tacos' | 'blank';
  name: string;
  /** Prose only: never put counts here, the summary derives them from the data. */
  description: string;
  theme: string;
  /** Display order is the array order. */
  categories: string[];
  products: TemplateProduct[];
  additions: TemplateAddition[];
}

export interface RestaurantTemplateSummary {
  id: RestaurantTemplate['id'];
  name: string;
  description: string;
  productCount: number;
  additionCount: number;
}

export const RESTAURANT_TEMPLATES: RestaurantTemplate[] = [
  {
    id: 'burger',
    name: 'Hamburguesería',
    description: 'Hamburguesas artesanales con acompañamientos, bebidas y adicionales listos para vender.',
    theme: 'dark-charcoal',
    categories: ['Hamburguesas', 'Acompañamientos', 'Bebidas'],
    products: [
      {
        name: 'Clásica',
        description: 'Carne de res 150 g, queso cheddar, lechuga, tomate y salsa de la casa en pan brioche.',
        price: 26000,
        category: 'Hamburguesas',
        isPopular: true,
        preparationTimeMinutes: 15,
      },
      {
        name: 'Doble Queso',
        description: 'Doble carne de res, doble queso cheddar, pepinillos y cebolla en pan brioche.',
        price: 34000,
        category: 'Hamburguesas',
        preparationTimeMinutes: 18,
      },
      {
        name: 'BBQ Tocineta',
        description: 'Carne de res, tocineta crocante, aros de cebolla y salsa BBQ ahumada.',
        price: 32000,
        category: 'Hamburguesas',
        isNew: true,
        preparationTimeMinutes: 18,
      },
      {
        name: 'Papas a la Francesa',
        description: 'Porción de papas fritas crocantes con sal de ajo.',
        price: 12000,
        category: 'Acompañamientos',
        preparationTimeMinutes: 10,
      },
      {
        name: 'Aros de Cebolla',
        description: 'Aros de cebolla apanados, servidos con salsa de la casa.',
        price: 13000,
        category: 'Acompañamientos',
        preparationTimeMinutes: 10,
      },
      {
        name: 'Limonada Natural',
        description: 'Limonada fresca de la casa, 400 ml.',
        price: 8000,
        category: 'Bebidas',
        preparationTimeMinutes: 5,
      },
    ],
    additions: [
      { name: 'Tocineta', price: 4000 },
      { name: 'Queso extra', price: 3000 },
      { name: 'Huevo', price: 3000 },
      { name: 'Cebolla caramelizada', price: 2500 },
      { name: 'Jalapeños', price: 2000 },
      { name: 'Carne extra', price: 8000 },
      { name: 'Salsa de la casa', price: 1500 },
    ],
  },
  {
    id: 'pizza',
    name: 'Pizzería',
    description: 'Pizzas individuales al horno con bebidas y adicionales para personalizarlas.',
    theme: 'warm-cream',
    categories: ['Pizzas', 'Bebidas'],
    products: [
      {
        name: 'Margarita',
        description: 'Salsa de tomate, mozzarella fresca y albahaca.',
        price: 28000,
        category: 'Pizzas',
        isPopular: true,
        preparationTimeMinutes: 20,
      },
      {
        name: 'Pepperoni',
        description: 'Salsa de tomate, mozzarella y abundante pepperoni.',
        price: 34000,
        category: 'Pizzas',
        isPopular: true,
        preparationTimeMinutes: 20,
      },
      {
        name: 'Hawaiana',
        description: 'Salsa de tomate, mozzarella, jamón y piña caramelizada.',
        price: 32000,
        category: 'Pizzas',
        preparationTimeMinutes: 20,
      },
      {
        name: 'Cuatro Quesos',
        description: 'Mozzarella, parmesano, queso azul y provolone sobre base de crema.',
        price: 38000,
        category: 'Pizzas',
        isNew: true,
        preparationTimeMinutes: 22,
      },
      {
        name: 'Gaseosa 400 ml',
        description: 'Gaseosa personal, bien fría.',
        price: 5000,
        category: 'Bebidas',
        preparationTimeMinutes: 2,
      },
      {
        name: 'Jugo de Naranja',
        description: 'Jugo de naranja natural exprimido al momento, 350 ml.',
        price: 7000,
        category: 'Bebidas',
        preparationTimeMinutes: 5,
      },
    ],
    additions: [
      { name: 'Queso extra', price: 4000 },
      { name: 'Borde de queso', price: 6000 },
      { name: 'Champiñones', price: 3500 },
      { name: 'Pepperoni extra', price: 5000 },
      { name: 'Aceitunas', price: 3000 },
    ],
  },
  {
    id: 'tacos',
    name: 'Taquería',
    description: 'Tacos y quesadillas con bebidas y adicionales como guacamole y salsas.',
    theme: 'clean-white',
    categories: ['Tacos', 'Quesadillas', 'Bebidas'],
    products: [
      {
        name: 'Tacos al Pastor',
        description: 'Tres tortillas de maíz con cerdo al pastor, piña, cebolla y cilantro.',
        price: 22000,
        category: 'Tacos',
        isPopular: true,
        preparationTimeMinutes: 12,
      },
      {
        name: 'Tacos de Carne Asada',
        description: 'Tres tortillas de maíz con carne asada, cebolla y cilantro.',
        price: 24000,
        category: 'Tacos',
        preparationTimeMinutes: 12,
      },
      {
        name: 'Tacos de Pollo',
        description: 'Tres tortillas de maíz con pollo adobado, pico de gallo y limón.',
        price: 21000,
        category: 'Tacos',
        preparationTimeMinutes: 12,
      },
      {
        name: 'Quesadilla de Queso',
        description: 'Tortilla de harina rellena de queso mozzarella fundido.',
        price: 16000,
        category: 'Quesadillas',
        preparationTimeMinutes: 10,
      },
      {
        name: 'Quesadilla de Pollo',
        description: 'Tortilla de harina con pollo desmechado y queso fundido.',
        price: 20000,
        category: 'Quesadillas',
        isNew: true,
        preparationTimeMinutes: 12,
      },
      {
        name: 'Agua de Jamaica',
        description: 'Agua fresca de flor de jamaica, 400 ml.',
        price: 7000,
        category: 'Bebidas',
        preparationTimeMinutes: 3,
      },
    ],
    additions: [
      { name: 'Guacamole', price: 4000 },
      { name: 'Queso extra', price: 3000 },
      { name: 'Salsa picante', price: 1500 },
      { name: 'Cebolla y cilantro', price: 1000 },
      { name: 'Crema agria', price: 2000 },
    ],
  },
  {
    id: 'blank',
    name: 'En blanco',
    description: 'Restaurante vacío: el administrador carga su propio menú desde cero.',
    theme: 'dark-charcoal',
    categories: [],
    products: [],
    additions: [],
  },
];

export function getRestaurantTemplate(id: string): RestaurantTemplate | undefined {
  return RESTAURANT_TEMPLATES.find((t) => t.id === id);
}

export function listRestaurantTemplateSummaries(): RestaurantTemplateSummary[] {
  return RESTAURANT_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    productCount: t.products.length,
    additionCount: t.additions.length,
  }));
}

/**
 * Approximate size of one COP in the currency, with the rounding step that
 * keeps menu prices looking natural there. Deliberately coarse and static: it
 * only makes sample dishes plausible and the owner edits them anyway. A
 * currency that is not listed keeps the declared numbers (see scaleTemplatePrice).
 */
const PRICE_SCALE: Record<string, { perCop: number; step: number }> = {
  COP: { perCop: 1, step: 500 },
  MXN: { perCop: 0.0045, step: 1 },
  USD: { perCop: 0.00025, step: 0.5 },
  EUR: { perCop: 0.00023, step: 0.5 },
  PEN: { perCop: 0.00095, step: 0.5 },
  BRL: { perCop: 0.0014, step: 0.5 },
  CLP: { perCop: 0.23, step: 100 },
  ARS: { perCop: 0.3, step: 100 },
  UYU: { perCop: 0.01, step: 5 },
};

export function scaleTemplatePrice(copPrice: number, currency: string): number {
  if (currency === DEFAULT_CURRENCY) return copPrice;
  const scale = PRICE_SCALE[currency];
  if (!scale) return copPrice;
  const rounded = Math.round((copPrice * scale.perCop) / scale.step) * scale.step;
  return Math.max(scale.step, Number(rounded.toFixed(2)));
}
