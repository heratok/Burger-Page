export type Burger = {
  name: string;
  src: string;
  price: number;
  description: string;
};

export type Adicion = {
  name: string;
  price: number;
  cantidad: number;
  src: string;
};

export type BurgerCompra = {
  adicion: Adicion[];
  name: string;
  src: string;
  totalapagar: number;
  cantidad: number;
  observacion: string;
};

export const hamburguesas: Burger[] = [
  {
    name: "Misisipi",
    src: "https://content-cocina.lecturas.com/medio/2021/12/17/recetas-de-hamburguesas-cocineros_9cfe156f_1200x1200.jpg",
    price: 27000,
    description:
      "La Misisipi Burger es una oda a los sabores robustos y la rica herencia culinaria del sur de Estados Unidos.",
  },
  {
    name: "La Pollo",
    src: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80",
    price: 22900,
    description:
      "La deliciosa hamburguesa 'La Pollo' es una creación única de nuestra casa,te hará regresar por más.",
  },
  {
    name: "Cangreburger",
    src: "https://d1ralsognjng37.cloudfront.net/b219efa7-5c20-4eab-9426-2cda449a4b6b.jpeg",
    price: 27900,
    description:
      "La exquisita Cangreburger es la joya de nuestra carta, una creación marina que despierta tus sentidos con cada bocado.",
  },
  {
    name: "La Chichona",
    src: "https://tb-static.uber.com/prod/image-proc/processed_images/32fdcd0acffcd1d410575aa21e29c7cb/719c6bd2757b08684c0faae44d43159d.jpeg",
    price: 25000,
    description:
      "La Chichona es una hamburguesa que se ha ganado su lugar en el corazón de nuestros comensales.",
  },
  {
    name: "MegaBurger",
    src: "https://img.restaurantguru.com/rb45-Shark-Burgers-Playa-del-Carmen-Av-115-burger-2022-09-11.jpg",
    price: 27000,
    description:
      "La MegaBurger es un coloso culinario, una auténtica maravilla para los amantes de las hamburguesas.",
  },
];

export const ADICIONES_INICIALES: Adicion[] = [
  {
    name: "papas fritas",
    price: 5000,
    cantidad: 0,
    src: "https://express.donangelo.pe/wp-content/uploads/2022/05/WhatsApp-Image-2022-05-28-at-10.47.42-AM-10.jpeg",
  },
  {
    name: "Cebolla Caramelizada",
    price: 1500,
    cantidad: 0,
    src: "https://www.divinacocina.es/wp-content/uploads/cebolla-caramelizada7.jpg",
  },
  {
    name: "Extra queso",
    price: 2700,
    cantidad: 0,
    src: "https://www.los-almendros.com.ar/shop/wp-content/uploads/ofertaa-queso-raclette-fermier-env-sin-cargo-cap-fed-D_NQ_NP_963843-MLA27191786169_042018-F.jpg",
  },
  {
    name: "Tocineta",
    price: 2500,
    cantidad: 0,
    src: "https://tienda.atlantic.la/cdn/shop/files/TOCINETAPREMIUM_1024x.jpg?v=1684335896",
  },
];