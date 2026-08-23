import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { errorHandler } from './middlewares/errorHandler.js';

// Repositories
import { InMemoryRestaurantRepository } from '../persistence/InMemoryRestaurantRepository.js';
import { InMemoryProductRepository } from '../persistence/InMemoryProductRepository.js';
import { InMemoryOrderRepository } from '../persistence/InMemoryOrderRepository.js';
import { InMemoryCustomerRepository } from '../persistence/InMemoryCustomerRepository.js';
import { InMemoryInventoryRepository } from '../persistence/InMemoryInventoryRepository.js';

// Use Cases
import { GetRestaurantUseCase } from '../../application/use-cases/GetRestaurantUseCase.js';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase.js';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase.js';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase.js';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase.js';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase.js';
import { ListCustomersUseCase } from '../../application/use-cases/ListCustomersUseCase.js';
import { GetInventoryUseCase } from '../../application/use-cases/GetInventoryUseCase.js';
import { UpdateInventoryStockUseCase } from '../../application/use-cases/UpdateInventoryStockUseCase.js';

// Controllers
import { RestaurantController } from './controllers/RestaurantController.js';
import { ProductController } from './controllers/ProductController.js';
import { OrderController } from './controllers/OrderController.js';
import { CustomerController } from './controllers/CustomerController.js';
import { InventoryController } from './controllers/InventoryController.js';

// Routes
import { restaurantRoutes } from './routes/restaurant.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';

export interface AppDependencies {
  restaurantController: RestaurantController;
  productController: ProductController;
  orderController: OrderController;
  customerController: CustomerController;
  inventoryController: InventoryController;
}

export function buildDependencies(): AppDependencies {
  // Repos
  const restaurantRepo = new InMemoryRestaurantRepository();
  const productRepo = new InMemoryProductRepository();
  const orderRepo = new InMemoryOrderRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const inventoryRepo = new InMemoryInventoryRepository();

  // Use Cases
  const getRestaurant = new GetRestaurantUseCase(restaurantRepo);
  
  const listProducts = new ListProductsUseCase(productRepo);
  const getProductById = new GetProductByIdUseCase(productRepo);
  const createProduct = new CreateProductUseCase(productRepo);
  const updateProduct = new UpdateProductUseCase(productRepo);
  const deleteProduct = new DeleteProductUseCase(productRepo);

  const listOrders = new ListOrdersUseCase(orderRepo);
  const getOrderById = new GetOrderByIdUseCase(orderRepo);
  const createOrder = new CreateOrderUseCase(orderRepo, productRepo, customerRepo);
  const updateOrderStatus = new UpdateOrderStatusUseCase(orderRepo);

  const listCustomers = new ListCustomersUseCase(customerRepo);

  const getInventory = new GetInventoryUseCase(inventoryRepo);
  const updateInventoryStock = new UpdateInventoryStockUseCase(inventoryRepo);

  // Controllers
  return {
    restaurantController: new RestaurantController(getRestaurant),
    productController: new ProductController(listProducts, getProductById, createProduct, updateProduct, deleteProduct),
    orderController: new OrderController(listOrders, getOrderById, createOrder, updateOrderStatus),
    customerController: new CustomerController(listCustomers),
    inventoryController: new InventoryController(getInventory, updateInventoryStock)
  };
}

export function buildApp(dependencies?: Partial<AppDependencies>): FastifyInstance {
  const app = fastify({
    logger: true,
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['example']
      }
    }
  });

  const deps = { ...buildDependencies(), ...dependencies };

  app.register(cors, { origin: '*' });

  app.setErrorHandler(errorHandler);

  // 1. OpenAPI Specification with @fastify/swagger
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Burger Craft API',
        description: 'Hexagonal REST API for Burger-Page multi-tenant platform. Built with Fastify, TypeScript, and Zod.',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Local Development Server' }
      ],
      tags: [
        { name: 'Restaurant', description: 'Storefront config and multi-tenant settings' },
        { name: 'Products', description: 'Menu items, burgers, and additions' },
        { name: 'Orders', description: 'Order lifecycle management and checkout' },
        { name: 'Inventory', description: 'Stock levels, suppliers, and ingredients' },
        { name: 'Customers', description: 'Customer profiles and loyalty tiers' },
        { name: 'Health', description: 'Server health status' },
      ]
    }
  });

  // 2. Interactive Documentation with Scalar
  app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      theme: 'kepler',
      darkMode: true,
      pageTitle: 'Burger Craft API Reference',
    }
  });

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check endpoint',
      description: 'Verifies the server is online and operational.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' }
          }
        }
      }
    }
  }, async () => ({ status: 'ok' }));

  app.register(async (api) => {
    api.register(restaurantRoutes, { prefix: '/restaurant', controller: deps.restaurantController });
    api.register(productRoutes, { prefix: '/products', controller: deps.productController });
    api.register(orderRoutes, { prefix: '/orders', controller: deps.orderController });
    api.register(customerRoutes, { prefix: '/customers', controller: deps.customerController });
    api.register(inventoryRoutes, { prefix: '/inventory', controller: deps.inventoryController });
  }, { prefix: '/api' });

  return app;
}
