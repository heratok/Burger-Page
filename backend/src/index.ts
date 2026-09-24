import { existsSync } from 'node:fs';
import path from 'node:path';

// Automatically load .env file from backend/ or project root
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(import.meta.dirname, '../.env'),
  path.resolve(import.meta.dirname, '../../.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(envPath);
      }
    } catch {
      // Continue searching other candidates
    }
  }
}

import { buildApp } from './infrastructure/http/app.js';
import { resolveStorageDriver, dataRunsOnPostgres } from './infrastructure/persistence/driverSelection.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Security fail-fast: production must never boot with the public fallback JWT secret.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ [SECURITY] JWT_SECRET is required in production. Set it in the deployment environment before starting.');
  process.exit(1);
}

const app = buildApp();

// Filter harmless Fastify v5 deprecation notices from console noise
process.on('warning', (warning) => {
  if (warning.name === 'FastifyDeprecation' && (warning as any).code === 'FSTDEP023') {
    return;
  }
  console.warn(`[WARNING] ${warning.name}: ${warning.message}`);
});

// Global safety net for unhandled asynchronous errors
process.on('unhandledRejection', (reason, promise) => {
  app.log.error({ reason, promise }, 'Unhandled Rejection caught at process level');
});

// Global safety net for uncaught synchronous exceptions
process.on('uncaughtException', (error) => {
  app.log.error({ error }, 'Uncaught Exception caught at process level');
  // H3: the process is in an undefined state after an uncaught synchronous
  // exception — continuing to serve would mask corrupted invariants. Fail
  // fast so a supervisor restarts the process (previously it logged and
  // kept serving). Route-handler errors stay caught by Fastify's error
  // handler and never reach this hook.
  process.exit(1);
});

// Graceful shutdown deadline: SSE streams keep sockets open, and a stuck
// stream must never hang shutdown forever. The 10s race is the backstop.
const SHUTDOWN_DEADLINE_MS = 10_000;

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, closing server gracefully...`);
  try {
    await Promise.race([
      (async () => {
        await app.close();
        // Close the lazy Postgres pool when it exists; closePgPool() is
        // guarded and idempotent (no-op when the pool was never created).
        // Sqlite close is intentionally skipped: createSqliteDatabase() runs
        // inside buildDependencies() and the Database handle is not exposed
        // by buildApp(), so there is no reachable handle to close.
        try {
          const { closePgPool } = await import('./infrastructure/persistence/postgres/PgClient.js');
          await closePgPool();
        } catch (pgErr) {
          // A pool-end hiccup must not turn a successful server close into a
          // failed shutdown; the OS reclaims the sockets.
          app.log.warn({ err: pgErr }, 'Postgres pool close failed during shutdown; continuing');
        }
      })(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          app.log.warn(`Graceful shutdown deadline (${SHUTDOWN_DEADLINE_MS}ms) reached; proceeding with exit`);
          resolve();
        }, SHUTDOWN_DEADLINE_MS);
      }),
    ]);
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 [SERVER] Servidor corriendo en http://${HOST}:${PORT}`);
    console.log(`📚 [DOCS]   Documentación OpenAPI/Scalar en http://${HOST}:${PORT}/docs`);

    // Single source of truth for driver selection (D3): probe the pool only
    // when data flows through Postgres (postgres or supabase, both S5 pooler).
    const selectedDriver = resolveStorageDriver();

    if (dataRunsOnPostgres(selectedDriver)) {
      try {
        const { verifyPgConnection } = await import('./infrastructure/persistence/postgres/PgClient.js');
        const dbStatus = await verifyPgConnection();
        if (dbStatus.ok) {
          console.log(`\n✅ [POSTGRES] Conexión a Base de Datos verificada exitosamente`);
          console.log(`   ├─ Base de datos : ${dbStatus.database}`);
          console.log(`   ├─ Usuario activo: ${dbStatus.user}`);
          console.log(`   └─ Host          : ${dbStatus.host}\n`);
        } else {
          console.error(`\n❌ [POSTGRES] Error al conectar a la Base de Datos: ${dbStatus.error}\n`);
          // H3: default remains degraded boot (tests/dev stay unaffected);
          // PG_FAIL_FAST=true opts production deployments into fail-fast.
          if ((process.env.PG_FAIL_FAST || '').toLowerCase() === 'true') {
            console.error('❌ [POSTGRES] PG_FAIL_FAST=true: refusing to boot with an unreachable database. Set PG_FAIL_FAST=false to allow degraded boot.');
            process.exit(1);
          }
        }
      } catch (dbErr: any) {
        console.error(`\n❌ [POSTGRES] Error al verificar la Base de Datos: ${dbErr?.message || dbErr}\n`);
        if ((process.env.PG_FAIL_FAST || '').toLowerCase() === 'true') {
          console.error('❌ [POSTGRES] PG_FAIL_FAST=true: refusing to boot with an unreachable database. Set PG_FAIL_FAST=false to allow degraded boot.');
          process.exit(1);
        }
      }
    } else if (selectedDriver === 'sqlite') {
      console.log(`\n✅ [SQLITE] Base de datos local inicializada correctamente\n`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
