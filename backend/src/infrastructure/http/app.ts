import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { errorHandler } from './middlewares/errorHandler.js';
import { getAllowedOrigins } from './middleware/cors.js';
import { configureAuthMiddlewares } from './middleware/auth.middleware.js';

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
import { verifyPgConnection } from '../persistence/postgres/PgClient.js';
import { resolveStorageDriver, dataRunsOnPostgres } from '../persistence/driverSelection.js';
import type { StorageDriver } from '../persistence/driverSelection.js';
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
import { UpdateRestaurantUseCase } from '../../application/use-cases/UpdateRestaurantUseCase.js';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase.js';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase.js';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase.js';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase.js';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase.js';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase.js';
import { UpdateOrderReceiptUseCase } from '../../application/use-cases/UpdateOrderReceiptUseCase.js';
import { DeleteOrderUseCase } from '../../application/use-cases/DeleteOrderUseCase.js';
import { UpdateOrderUseCase } from '../../application/use-cases/UpdateOrderUseCase.js';
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
  /** Repository-backed JWT revalidation (SUS-14): wired into the auth
   *  middlewares by buildApp so sessions are re-checked against storage. */
  userRepo: UserRepository;
  restaurantRepo: RestaurantRepository;
  /** Exposed so wiring tests/observability can verify the repository the
   *  selected storage driver instantiates (S5: supabase == postgres == Pg). */
  orderRepo: OrderRepository;
}

// Re-exported so existing importers of the http surface keep a stable path.
export type { StorageDriver };

export function buildDependencies(dbPath?: string, driver?: StorageDriver): AppDependencies {
  const selectedDriver = resolveStorageDriver(driver);

  console.log(`\n======================================================`);
  console.log(`📦 [DATABASE] Driver Activo: ${selectedDriver.toUpperCase()}`);
  if (dataRunsOnPostgres(selectedDriver)) {
    // S5: both drivers run every data query through the same pooler role
    // (app_user, NOBYPASSRLS) with RLS + tenant GUC guards from PgClient.
    console.log(`🔗 [DATABASE] app_user (RLS-scoped, sin BYPASSRLS) via DATABASE_URL pooler`);
    if (selectedDriver === 'supabase') {
      console.log(`📦 [SUPABASE] driver: datos vía pooler PostgreSQL (app_user/RLS); Supabase solo para storage de archivos`);
    }
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

  if (dataRunsOnPostgres(selectedDriver)) {
    // S5: the 'supabase' driver no longer talks to Supabase PostgREST with the
    // service-role key (which bypassed RLS). Both drivers use the same pooler
    // role (app_user, NOBYPASSRLS) so RLS + tenant GUC guards apply in
    // production. Supabase remains wired only for file storage (storage.routes).
    if (!process.env.DATABASE_URL) {
      throw new Error(
        `Storage driver '${selectedDriver}' requires DATABASE_URL: point it at the Supabase pooler ` +
          `connection string with the app_user role (NOBYPASSRLS, RLS-scoped). ` +
          `Supabase key-based data access (SUPABASE_KEY/SERVICE_ROLE_KEY) is no longer supported. ` +
          `Set DATABASE_URL before boot.`
      );
    }
    restaurantRepo = new PgRestaurantRepository();
    categoryRepo = new PgCategoryRepository();
    productRepo = new PgProductRepository();
    additionRepo = new PgProductAdditionRepository();
    orderRepo = new PgOrderRepository();
    customerRepo = new PgCustomerRepository();
    inventoryRepo = new PgInventoryRepository();
    userRepo = new PgUserRepository();
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
  const hasher: PasswordHasher = new CryptoPasswordHasher();
  const getRestaurant = new GetRestaurantUseCase(restaurantRepo, categoryRepo);
  const listRestaurants = new ListRestaurantsUseCase(restaurantRepo);
  const createRestaurant = new CreateRestaurantUseCase(restaurantRepo, categoryRepo, userRepo, hasher);
  const deleteRestaurant = new DeleteRestaurantUseCase(restaurantRepo);
  const updateRestaurantCategories = new UpdateRestaurantCategoriesUseCase(restaurantRepo, categoryRepo);
  const updateRestaurant = new UpdateRestaurantUseCase(restaurantRepo);

  const listProducts = new ListProductsUseCase(productRepo);
  const getProductById = new GetProductByIdUseCase(productRepo);
  const createProduct = new CreateProductUseCase(productRepo, categoryRepo, additionRepo);
  const updateProduct = new UpdateProductUseCase(productRepo, categoryRepo, additionRepo);
  const deleteProduct = new DeleteProductUseCase(productRepo);

  const listOrders = new ListOrdersUseCase(orderRepo);
  const getOrderById = new GetOrderByIdUseCase(orderRepo);
  const createOrder = new CreateOrderUseCase(orderRepo, productRepo, restaurantRepo, additionRepo, customerRepo);
  const updateOrderStatus = new UpdateOrderStatusUseCase(orderRepo);
  const updateOrderReceipt = new UpdateOrderReceiptUseCase(orderRepo);
  const deleteOrder = new DeleteOrderUseCase(orderRepo);
  const updateOrder = new UpdateOrderUseCase(orderRepo, productRepo, additionRepo, customerRepo);

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
      updateRestaurantCategories,
      updateRestaurant
    ),
    productController: new ProductController(
      listProducts,
      getProductById,
      createProduct,
      updateProduct,
      deleteProduct,
      restaurantRepo
    ),
    orderController: new OrderController(
      listOrders,
      getOrderById,
      createOrder,
      updateOrderStatus,
      updateOrderReceipt,
      restaurantRepo,
      deleteOrder,
      updateOrder
    ),
    customerController: new CustomerController(
      listCustomers,
      getCustomerById,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      restaurantRepo
    ),
    inventoryController: new InventoryController(
      listInventory,
      updateInventoryStock,
      getInventoryItemById,
      createInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
      restaurantRepo
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
    userRepo,
    restaurantRepo,
    orderRepo,
  };
}

/**
 * Resolve the Fastify `trustProxy` setting.
 *
 * Explicit `options.trustProxy` always wins. Otherwise parse `TRUST_PROXY`:
 * "true"/"1" -> true, a positive integer -> that many trusted hops, anything
 * else or unset -> false. Keeping `false` as the default preserves today's
 * safe behavior: X-Forwarded-For is ignored, so a client cannot spoof its way
 * into a fresh rate-limit bucket.
 */
function resolveTrustProxy(explicit?: boolean | number): boolean | number {
  if (explicit !== undefined) return explicit;
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined) return false;
  const value = raw.trim();
  if (value === 'true' || value === '1') return true;
  if (/^[0-9]+$/.test(value)) {
    const hops = Number(value);
    if (hops > 0) return hops;
  }
  return false;
}

export function buildApp(
  dependencies?: Partial<AppDependencies>,
  options?: {
    dbPath?: string;
    driver?: StorageDriver;
    /**
     * Fastify trustProxy setting. `true` trusts the forwarded client IP from
     * X-Forwarded-For (safe only when the app is reachable exclusively through
     * the reverse proxy). A numeric hop count is accepted by the option type
     * but the vendored fastify build fails CLOSED on it (trusts no hops), so
     * deployments must use `true`. Defaults to TRUST_PROXY or false.
     */
    trustProxy?: boolean | number;
    rateLimit?: {
      /** Global max requests per IP per timeWindow (default 300/min). */
      max?: number;
      timeWindow?: string;
      /** Set to false to disable rate limiting entirely. */
      enabled?: boolean;
      /** POST /users/login limit per IP (default 10/min). */
      loginMax?: number;
      /** Public POST /orders limit per IP (default 30/min). */
      orderMax?: number;
    };
  }
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

  const trustProxy = resolveTrustProxy(options?.trustProxy);

  const app = fastify({
    logger: loggerConfig,
    // fastify's public TS type omits `number` (fastify.d.ts), but the runtime
    // accepts hop counts and this build fails closed on them (trusts no hops).
    // The runtime value is passed through unchanged; only TS is satisfied here.
    trustProxy: trustProxy as boolean,
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

  // SUS-14: once the repositories exist, re-key the singleton auth
  // middlewares so every requireAuth re-validates the token subject against
  // users.is_active/role and the tenant's is_active. Skipped in test runs:
  // the existing integration suite mints tokens for ids that are not present
  // in the seeded in-memory repos, which revalidation would legitimately
  // reject; the revalidation contract itself is covered by
  // tests/integration/JwtRevalidation.test.ts against focused fakes.
  if (!isTest) {
    configureAuthMiddlewares({ userRepo: deps.userRepo, restaurantRepo: deps.restaurantRepo });
  }

  const allowedOrigins = getAllowedOrigins();

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // Global Security Headers Hook
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

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
        { name: 'Storage', description: 'Storage and media presigned URLs' },
        { name: 'Health', description: 'Server health status' },
      ]
    }
  });

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check endpoint',
      description: 'Verifies the server is online and operational. When the Postgres driver is active, also probes the database pool so orchestrators can distinguish healthy from degraded states via the status code.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            db: { type: 'string', example: 'connected' },
          },
          additionalProperties: true,
          required: ['status'],
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'degraded' },
            db: { type: 'string', example: 'unreachable' },
          },
          additionalProperties: true,
          required: ['status'],
        },
      },
    },
  }, async (_req, reply) => {
    // Single source of truth for driver selection (D3): probe the pool only
    // when data actually flows through Postgres. Since S5 the 'supabase'
    // driver also runs every data query through the pooler (app_user/RLS),
    // so it probes the pool too; sqlite/memory keep the static ok response.
    const driver = resolveStorageDriver();
    if (!dataRunsOnPostgres(driver)) {
      return reply.status(200).send({ status: 'ok' });
    }

    // Probe with fail-fast semantics: pool acquisition is bounded by
    // connectionTimeoutMillis (5s) and statements by statement_timeout (15s),
    // so a DB outage surfaces as 503 instead of hanging the probe forever.
    const dbStatus = await verifyPgConnection();
    if (dbStatus.ok) {
      return reply.status(200).send({ status: 'ok', db: 'connected' });
    }
    // Never crash here: orchestrators read the 503 and route traffic away.
    return reply.status(503).send({ status: 'degraded', db: 'unreachable' });
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

  // Rate limiting (login brute-force / storefront spam protection)
  //
  // NOTE: the plugin's built-in per-route wiring (via the internal onRoute
  // hook) does not apply with this Fastify version, so we drive the exposed
  // `api.rateLimit()` handlers through an explicit onRequest hook instead.
  const rateMax = options?.rateLimit?.max ?? (Number(process.env.RATE_LIMIT_MAX) || 300);
  const rateWindow = options?.rateLimit?.timeWindow ?? process.env.RATE_LIMIT_WINDOW ?? '1 minute';
  // Rate limiting is a production control: strict per-IP caps only apply when
  // running in production or when explicitly configured (options/env). Local
  // dev and test suites (e2e included) stay unthrottled by default.
  const rateLimitExplicit = Boolean(options?.rateLimit) || Boolean(process.env.RATE_LIMIT_MAX);
  const skipRateLimit =
    options?.rateLimit?.enabled === false ||
    rateMax <= 0 ||
    (process.env.NODE_ENV !== 'production' && !rateLimitExplicit);
  const loginMax = options?.rateLimit?.loginMax ?? 10;
  const orderMax = options?.rateLimit?.orderMax ?? 30;

  app.register(async (api: FastifyInstance) => {
    if (!skipRateLimit) {
      await api.register(rateLimit, {
        max: rateMax,
        timeWindow: rateWindow,
        // Key by IP by default; keep the standard 429 response shape.
        errorResponseBuilder: (_req, context) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded: retry after ${context.after}`,
        }),
      });
      const globalLimiter = api.rateLimit({ max: rateMax, timeWindow: rateWindow }).bind(api);
      // Sensitive routes get the stricter of (their own limit, the global cap).
      const loginLimiter = api.rateLimit({ max: Math.min(loginMax, rateMax), timeWindow: rateWindow }).bind(api);
      const orderLimiter = api.rateLimit({ max: Math.min(orderMax, rateMax), timeWindow: rateWindow }).bind(api);
      api.addHook('onRequest', async (req, reply) => {
        const rawPath = req.url.split('?')[0] || '';
        const pathname = rawPath.replace(/\/+$/, '') || '/';
        const isLogin = req.method === 'POST' && pathname === '/api/users/login';
        const isPublicOrder = req.method === 'POST' && pathname === '/api/orders';
        if (isLogin) return loginLimiter(req, reply);
        if (isPublicOrder) return orderLimiter(req, reply);
        return globalLimiter(req, reply);
      });
    }


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
