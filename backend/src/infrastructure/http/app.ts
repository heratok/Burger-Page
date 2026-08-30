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
import { InMemoryUserRepository } from '../persistence/InMemoryUserRepository.js';
import { createSqliteDatabase } from '../persistence/sqlite/SqliteDatabase.js';
import { SqliteRestaurantRepository } from '../persistence/sqlite/SqliteRestaurantRepository.js';
import { SqliteProductRepository } from '../persistence/sqlite/SqliteProductRepository.js';
import { SqliteOrderRepository } from '../persistence/sqlite/SqliteOrderRepository.js';
import { SqliteCustomerRepository } from '../persistence/sqlite/SqliteCustomerRepository.js';
import { SqliteInventoryRepository } from '../persistence/sqlite/SqliteInventoryRepository.js';
import { getSupabaseClient } from '../persistence/supabase/SupabaseClient.js';
import { SupabaseRestaurantRepository } from '../persistence/supabase/SupabaseRestaurantRepository.js';
import { SupabaseProductRepository } from '../persistence/supabase/SupabaseProductRepository.js';
import { SupabaseOrderRepository } from '../persistence/supabase/SupabaseOrderRepository.js';
import { SupabaseCustomerRepository } from '../persistence/supabase/SupabaseCustomerRepository.js';
import { SupabaseInventoryRepository } from '../persistence/supabase/SupabaseInventoryRepository.js';
import { SupabaseUserRepository } from '../persistence/supabase/SupabaseUserRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { CryptoPasswordHasher } from '../security/CryptoPasswordHasher.js';


// Use Cases
import { GetRestaurantUseCase } from '../../application/use-cases/GetRestaurantUseCase.js';
import { ListRestaurantsUseCase } from '../../application/use-cases/ListRestaurantsUseCase.js';
import { CreateRestaurantUseCase } from '../../application/use-cases/CreateRestaurantUseCase.js';
import { DeleteRestaurantUseCase } from '../../application/use-cases/DeleteRestaurantUseCase.js';
import { UpdateRestaurantCategoriesUseCase } from '../../application/use-cases/UpdateRestaurantCategoriesUseCase.js';
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
import { CreateUserUseCase } from '../../application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase.js';

// Controllers
import { RestaurantController } from './controllers/RestaurantController.js';
import { ProductController } from './controllers/ProductController.js';
import { OrderController } from './controllers/OrderController.js';
import { CustomerController } from './controllers/CustomerController.js';
import { InventoryController } from './controllers/InventoryController.js';
import { UserController } from './controllers/UserController.js';

// Routes
import { restaurantRoutes } from './routes/restaurant.routes.js';
import { restaurantsRoutes } from './routes/restaurants.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { userRoutes } from './routes/user.routes.js';

export interface AppDependencies {
  restaurantController: RestaurantController;
  productController: ProductController;
  orderController: OrderController;
  customerController: CustomerController;
  inventoryController: InventoryController;
  userController: UserController;
}

export type StorageDriver = 'memory' | 'sqlite' | 'supabase';

export function buildDependencies(dbPath?: string, driver?: StorageDriver): AppDependencies {
  let selectedDriver: StorageDriver = driver || (process.env.STORAGE_DRIVER as StorageDriver);
  if (!selectedDriver && process.env.SUPABASE_URL) {
    selectedDriver = 'supabase';
  }
  if (!selectedDriver) {
    selectedDriver = 'memory';
  }

  let restaurantRepo: RestaurantRepository;
  let productRepo: ProductRepository;
  let orderRepo: OrderRepository;
  let customerRepo: CustomerRepository;
  let inventoryRepo: InventoryRepository;
  let userRepo: UserRepository;

  if (selectedDriver === 'supabase') {
    try {
      const supabaseClient = getSupabaseClient();
      restaurantRepo = new SupabaseRestaurantRepository(supabaseClient);
      productRepo = new SupabaseProductRepository(supabaseClient);
      orderRepo = new SupabaseOrderRepository(supabaseClient);
      customerRepo = new SupabaseCustomerRepository(supabaseClient);
      inventoryRepo = new SupabaseInventoryRepository(supabaseClient);
      userRepo = new SupabaseUserRepository(supabaseClient);
    } catch (err) {
      console.warn('Supabase initialization failed, falling back to InMemory/SQLite:', err);
      if (process.env.DATABASE_PATH) {
        const db = createSqliteDatabase(dbPath || process.env.DATABASE_PATH);
        restaurantRepo = new SqliteRestaurantRepository(db);
        productRepo = new SqliteProductRepository(db);
        orderRepo = new SqliteOrderRepository(db);
        customerRepo = new SqliteCustomerRepository(db);
        inventoryRepo = new SqliteInventoryRepository(db);
        userRepo = new InMemoryUserRepository();
      } else {
        restaurantRepo = new InMemoryRestaurantRepository();
        productRepo = new InMemoryProductRepository();
        orderRepo = new InMemoryOrderRepository();
        customerRepo = new InMemoryCustomerRepository();
        inventoryRepo = new InMemoryInventoryRepository();
        userRepo = new InMemoryUserRepository();
      }
    }
  } else if (selectedDriver === 'sqlite') {
    const db = createSqliteDatabase(dbPath || process.env.DATABASE_PATH || ':memory:');
    restaurantRepo = new SqliteRestaurantRepository(db);
    productRepo = new SqliteProductRepository(db);
    orderRepo = new SqliteOrderRepository(db);
    customerRepo = new SqliteCustomerRepository(db);
    inventoryRepo = new SqliteInventoryRepository(db);
    userRepo = new InMemoryUserRepository();
  } else {
    restaurantRepo = new InMemoryRestaurantRepository();
    productRepo = new InMemoryProductRepository();
    orderRepo = new InMemoryOrderRepository();
    customerRepo = new InMemoryCustomerRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    userRepo = new InMemoryUserRepository();
  }

  // Use Cases
  const getRestaurant = new GetRestaurantUseCase(restaurantRepo);
  const listRestaurants = new ListRestaurantsUseCase(restaurantRepo);
  const createRestaurant = new CreateRestaurantUseCase(restaurantRepo);
  const deleteRestaurant = new DeleteRestaurantUseCase(restaurantRepo);
  const updateRestaurantCategories = new UpdateRestaurantCategoriesUseCase(restaurantRepo);
  
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

  const hasher: PasswordHasher = new CryptoPasswordHasher();
  const createUser = new CreateUserUseCase(userRepo, hasher);
  const authenticateUser = new AuthenticateUserUseCase(userRepo, hasher);
  const listUsersUC = new ListUsersUseCase(userRepo);

  // Controllers
  return {
    restaurantController: new RestaurantController(
      getRestaurant,
      listRestaurants,
      createRestaurant,
      deleteRestaurant,
      updateRestaurantCategories
    ),
    productController: new ProductController(listProducts, getProductById, createProduct, updateProduct, deleteProduct),
    orderController: new OrderController(listOrders, getOrderById, createOrder, updateOrderStatus),
    customerController: new CustomerController(listCustomers),
    inventoryController: new InventoryController(getInventory, updateInventoryStock),
    userController: new UserController(createUser, authenticateUser, listUsersUC),
  };
}

export function buildApp(
  dependencies?: Partial<AppDependencies>,
  options?: { dbPath?: string; driver?: StorageDriver }
): FastifyInstance {
  const app = fastify({
    logger: true,
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['example']
      }
    }
  });

  const deps = { ...buildDependencies(options?.dbPath, options?.driver), ...dependencies };

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
        { name: 'Users', description: 'User management and authentication' },
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

  app.register(async (api: FastifyInstance) => {
    api.register(restaurantRoutes, { prefix: '/restaurant', controller: deps.restaurantController });
    api.register(restaurantsRoutes, { prefix: '/restaurants', controller: deps.restaurantController });
    api.register(productRoutes, { prefix: '/products', controller: deps.productController });
    api.register(orderRoutes, { prefix: '/orders', controller: deps.orderController });
    api.register(customerRoutes, { prefix: '/customers', controller: deps.customerController });
    api.register(inventoryRoutes, { prefix: '/inventory', controller: deps.inventoryController });
    api.register(userRoutes, { prefix: '/users', controller: deps.userController });
  }, { prefix: '/api' });

  return app;
}
