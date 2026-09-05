import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { errorHandler } from './middlewares/errorHandler.js';

// Repositories
import { InMemoryRestaurantRepository } from '../persistence/InMemoryRestaurantRepository.js';
import { InMemoryProductRepository } from '../persistence/InMemoryProductRepository.js';
import { InMemoryCategoryRepository } from '../persistence/InMemoryCategoryRepository.js';
import { InMemoryOrderRepository } from '../persistence/InMemoryOrderRepository.js';
import { InMemoryCustomerRepository } from '../persistence/InMemoryCustomerRepository.js';
import { InMemoryInventoryRepository } from '../persistence/InMemoryInventoryRepository.js';
import { InMemoryUserRepository } from '../persistence/InMemoryUserRepository.js';
import { createSqliteDatabase } from '../persistence/sqlite/SqliteDatabase.js';
import { SqliteRestaurantRepository } from '../persistence/sqlite/SqliteRestaurantRepository.js';
import { SqliteCategoryRepository } from '../persistence/sqlite/SqliteCategoryRepository.js';
import { SqliteProductRepository } from '../persistence/sqlite/SqliteProductRepository.js';
import { SqliteOrderRepository } from '../persistence/sqlite/SqliteOrderRepository.js';
import { SqliteCustomerRepository } from '../persistence/sqlite/SqliteCustomerRepository.js';
import { SqliteInventoryRepository } from '../persistence/sqlite/SqliteInventoryRepository.js';
import { SqliteProductAdditionRepository } from '../persistence/sqlite/SqliteProductAdditionRepository.js';
import { getSupabaseClient } from '../persistence/supabase/SupabaseClient.js';
import { SupabaseRestaurantRepository } from '../persistence/supabase/SupabaseRestaurantRepository.js';
import { SupabaseCategoryRepository } from '../persistence/supabase/SupabaseCategoryRepository.js';
import { SupabaseProductRepository } from '../persistence/supabase/SupabaseProductRepository.js';
import { SupabaseOrderRepository } from '../persistence/supabase/SupabaseOrderRepository.js';
import { SupabaseCustomerRepository } from '../persistence/supabase/SupabaseCustomerRepository.js';
import { SupabaseInventoryRepository } from '../persistence/supabase/SupabaseInventoryRepository.js';
import { SupabaseUserRepository } from '../persistence/supabase/SupabaseUserRepository.js';
import { SupabaseProductAdditionRepository } from '../persistence/supabase/SupabaseProductAdditionRepository.js';
import { InMemoryProductAdditionRepository } from '../persistence/InMemoryProductAdditionRepository.js';
import { PgRestaurantRepository } from '../persistence/postgres/PgRestaurantRepository.js';
import { PgCategoryRepository } from '../persistence/postgres/PgCategoryRepository.js';
import { PgProductRepository } from '../persistence/postgres/PgProductRepository.js';
import { PgProductAdditionRepository } from '../persistence/postgres/PgProductAdditionRepository.js';
import { PgOrderRepository } from '../persistence/postgres/PgOrderRepository.js';
import { PgCustomerRepository } from '../persistence/postgres/PgCustomerRepository.js';
import { PgInventoryRepository } from '../persistence/postgres/PgInventoryRepository.js';
import { PgUserRepository } from '../persistence/postgres/PgUserRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
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
import { GetCustomerByIdUseCase } from '../../application/use-cases/GetCustomerByIdUseCase.js';
import { CreateCustomerUseCase } from '../../application/use-cases/CreateCustomerUseCase.js';
import { UpdateCustomerUseCase } from '../../application/use-cases/UpdateCustomerUseCase.js';
import { DeleteCustomerUseCase } from '../../application/use-cases/DeleteCustomerUseCase.js';
import { ListInventoryUseCase } from '../../application/use-cases/ListInventoryUseCase.js';
import { GetInventoryItemByIdUseCase } from '../../application/use-cases/GetInventoryItemByIdUseCase.js';
import { CreateInventoryItemUseCase } from '../../application/use-cases/CreateInventoryItemUseCase.js';
import { UpdateInventoryStockUseCase } from '../../application/use-cases/UpdateInventoryStockUseCase.js';
import { UpdateInventoryItemUseCase } from '../../application/use-cases/UpdateInventoryItemUseCase.js';
import { DeleteInventoryItemUseCase } from '../../application/use-cases/DeleteInventoryItemUseCase.js';
import { CreateUserUseCase } from '../../application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase.js';
import { CreateProductAdditionUseCase } from '../../application/use-cases/CreateProductAdditionUseCase.js';
import { GetProductAdditionByIdUseCase } from '../../application/use-cases/GetProductAdditionByIdUseCase.js';
import { ListProductAdditionsUseCase } from '../../application/use-cases/ListProductAdditionsUseCase.js';
import { UpdateProductAdditionUseCase } from '../../application/use-cases/UpdateProductAdditionUseCase.js';
import { DeleteProductAdditionUseCase } from '../../application/use-cases/DeleteProductAdditionUseCase.js';

// Controllers
import { RestaurantController } from './controllers/RestaurantController.js';
import { ProductController } from './controllers/ProductController.js';
import { OrderController } from './controllers/OrderController.js';
import { CustomerController } from './controllers/CustomerController.js';
import { InventoryController } from './controllers/InventoryController.js';
import { UserController } from './controllers/UserController.js';
import { ProductAdditionController } from './controllers/ProductAdditionController.js';

// Routes
import { restaurantRoutes } from './routes/restaurant.routes.js';
import { restaurantsRoutes } from './routes/restaurants.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { additionRoutes } from './routes/addition.routes.js';
import { storageRoutes } from './routes/storage.routes.js';

export interface AppDependencies {
  restaurantController: RestaurantController;
  productController: ProductController;
  orderController: OrderController;
  customerController: CustomerController;
  inventoryController: InventoryController;
  userController: UserController;
  additionController: ProductAdditionController;
}

export type StorageDriver = 'memory' | 'sqlite' | 'supabase' | 'postgres';

export function buildDependencies(dbPath?: string, driver?: StorageDriver): AppDependencies {
  let selectedDriver: StorageDriver = driver || (process.env.STORAGE_DRIVER as StorageDriver);
  if (!selectedDriver && process.env.SUPABASE_URL) {
    selectedDriver = 'supabase';
  }
  if (!selectedDriver) {
    selectedDriver = 'memory';
  }

  console.log(`\n======================================================`);
  console.log(`📦 [DATABASE] Driver Activo: ${selectedDriver.toUpperCase()}`);
  if (selectedDriver === 'postgres') {
    console.log(`🔗 [POSTGRES] app_user (RLS-scoped, sin BYPASSRLS) via DATABASE_URL`);
  } else if (selectedDriver === 'supabase') {
    console.log(`🔗 [SUPABASE] URL: ${process.env.SUPABASE_URL}`);
    console.log(`🔑 [SUPABASE] Key: ${process.env.SUPABASE_KEY ? 'Configurada (***)' : 'FALTANTE'}`);
  } else if (selectedDriver === 'sqlite') {
    console.log(`💾 [SQLITE] Base de datos: ${dbPath || process.env.DATABASE_PATH || ':memory:'}`);
  } else {
    console.log(`⚠️  [STORAGE] Modo MEMORIA RAM (Los datos NO se guardan en Postgres/Supabase).`);
  }
  console.log(`======================================================\n`);

  let restaurantRepo: RestaurantRepository;
  let categoryRepo: CategoryRepository;
  let productRepo: ProductRepository;
  let additionRepo: ProductAdditionRepository;
  let orderRepo: OrderRepository;
  let customerRepo: CustomerRepository;
  let inventoryRepo: InventoryRepository;
  let userRepo: UserRepository;

  if (selectedDriver === 'postgres') {
    restaurantRepo = new PgRestaurantRepository();
    categoryRepo = new PgCategoryRepository();
    productRepo = new PgProductRepository();
    additionRepo = new PgProductAdditionRepository();
    orderRepo = new PgOrderRepository();
    customerRepo = new PgCustomerRepository();
    inventoryRepo = new PgInventoryRepository();
    userRepo = new PgUserRepository();
  } else if (selectedDriver === 'supabase') {
    const supabaseClient = getSupabaseClient();
    restaurantRepo = new SupabaseRestaurantRepository(supabaseClient);
    categoryRepo = new SupabaseCategoryRepository(supabaseClient);
    productRepo = new SupabaseProductRepository(supabaseClient);
    additionRepo = new SupabaseProductAdditionRepository(supabaseClient);
    orderRepo = new SupabaseOrderRepository(supabaseClient);
    customerRepo = new SupabaseCustomerRepository(supabaseClient);
    inventoryRepo = new SupabaseInventoryRepository(supabaseClient);
    userRepo = new SupabaseUserRepository(supabaseClient);
  } else if (selectedDriver === 'sqlite') {
    const db = createSqliteDatabase(dbPath || process.env.DATABASE_PATH || ':memory:');
    restaurantRepo = new SqliteRestaurantRepository(db);
    categoryRepo = new SqliteCategoryRepository(db);
    productRepo = new SqliteProductRepository(db);
    additionRepo = new SqliteProductAdditionRepository(db);
    orderRepo = new SqliteOrderRepository(db);
    customerRepo = new SqliteCustomerRepository(db);
    inventoryRepo = new SqliteInventoryRepository(db);
    userRepo = new InMemoryUserRepository();
  } else {
    restaurantRepo = new InMemoryRestaurantRepository();
    categoryRepo = new InMemoryCategoryRepository();
    productRepo = new InMemoryProductRepository();
    additionRepo = new InMemoryProductAdditionRepository();
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
  const createProduct = new CreateProductUseCase(productRepo, categoryRepo, additionRepo);
  const updateProduct = new UpdateProductUseCase(productRepo, categoryRepo, additionRepo);
  const deleteProduct = new DeleteProductUseCase(productRepo);

  const listOrders = new ListOrdersUseCase(orderRepo);
  const getOrderById = new GetOrderByIdUseCase(orderRepo);
  const createOrder = new CreateOrderUseCase(orderRepo, productRepo, restaurantRepo, additionRepo, customerRepo);
  const updateOrderStatus = new UpdateOrderStatusUseCase(orderRepo);

  const listCustomers = new ListCustomersUseCase(customerRepo);
  const getCustomerById = new GetCustomerByIdUseCase(customerRepo);
  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const updateCustomer = new UpdateCustomerUseCase(customerRepo);
  const deleteCustomer = new DeleteCustomerUseCase(customerRepo);

  const listInventory = new ListInventoryUseCase(inventoryRepo);
  const getInventoryItemById = new GetInventoryItemByIdUseCase(inventoryRepo);
  const createInventoryItem = new CreateInventoryItemUseCase(inventoryRepo);
  const updateInventoryStock = new UpdateInventoryStockUseCase(inventoryRepo);
  const updateInventoryItem = new UpdateInventoryItemUseCase(inventoryRepo);
  const deleteInventoryItem = new DeleteInventoryItemUseCase(inventoryRepo);

  const hasher: PasswordHasher = new CryptoPasswordHasher();
  const createUser = new CreateUserUseCase(userRepo, hasher, restaurantRepo);
  const authenticateUser = new AuthenticateUserUseCase(userRepo, hasher);
  const listUsersUC = new ListUsersUseCase(userRepo);

  const listAdditions = new ListProductAdditionsUseCase(additionRepo);
  const getAdditionById = new GetProductAdditionByIdUseCase(additionRepo);
  const createAddition = new CreateProductAdditionUseCase(additionRepo, productRepo);
  const updateAddition = new UpdateProductAdditionUseCase(additionRepo, productRepo);
  const deleteAddition = new DeleteProductAdditionUseCase(additionRepo);

  // Controllers
  return {
    restaurantController: new RestaurantController(
      getRestaurant,
      listRestaurants,
      createRestaurant,
      deleteRestaurant,
      updateRestaurantCategories
    ),
    productController: new ProductController(
      listProducts,
      getProductById,
      createProduct,
      updateProduct,
      deleteProduct,
      restaurantRepo
    ),
    orderController: new OrderController(listOrders, getOrderById, createOrder, updateOrderStatus),
    customerController: new CustomerController(
      listCustomers,
      getCustomerById,
      createCustomer,
      updateCustomer,
      deleteCustomer
    ),
    inventoryController: new InventoryController(
      listInventory,
      updateInventoryStock,
      getInventoryItemById,
      createInventoryItem,
      updateInventoryItem,
      deleteInventoryItem
    ),
    userController: new UserController(createUser, authenticateUser, listUsersUC),
    additionController: new ProductAdditionController(
      listAdditions,
      getAdditionById,
      createAddition,
      updateAddition,
      deleteAddition,
      restaurantRepo
    ),
  };
}

export function buildApp(
  dependencies?: Partial<AppDependencies>,
  options?: { dbPath?: string; driver?: StorageDriver }
): FastifyInstance {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  const loggerConfig = isTest
    ? false
    : isProduction
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,reqId',
              singleLine: true,
            },
          },
        };

  const app = fastify({
    logger: loggerConfig,
    ...((!isProduction && !isTest) ? { disableRequestLogging: true } : {}),
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['example']
      }
    }
  });

  if (!isProduction && !isTest) {
    app.addHook('onResponse', (request, reply, done) => {
      const ms = Math.round(reply.elapsedTime);
      request.log.info(`${request.method} ${request.url} ${reply.statusCode} - ${ms}ms`);
      done();
    });
  }

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
        { name: 'Additions', description: 'Product modifiers and extras' },
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
    api.register(additionRoutes, { prefix: '/additions', controller: deps.additionController });
    api.register(orderRoutes, { prefix: '/orders', controller: deps.orderController });
    api.register(customerRoutes, { prefix: '/customers', controller: deps.customerController });
    api.register(inventoryRoutes, { prefix: '/inventory', controller: deps.inventoryController });
    api.register(userRoutes, { prefix: '/users', controller: deps.userController });
    api.register(storageRoutes, { prefix: '/storage' });
  }, { prefix: '/api' });

  return app;
}
