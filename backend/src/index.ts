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

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

const app = buildApp();

// Global safety net for unhandled asynchronous errors
process.on('unhandledRejection', (reason, promise) => {
  app.log.error({ reason, promise }, 'Unhandled Rejection caught at process level');
});

// Global safety net for uncaught synchronous exceptions
process.on('uncaughtException', (error) => {
  app.log.error({ error }, 'Uncaught Exception caught at process level');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, closing server gracefully...`);
  try {
    await app.close();
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

    const selectedDriver = (
      process.env.STORAGE_DRIVER ||
      (process.env.SUPABASE_URL ? 'supabase' : (process.env.DATABASE_URL ? 'postgres' : 'memory'))
    ).toLowerCase();

    if (selectedDriver === 'postgres' || (selectedDriver !== 'supabase' && selectedDriver !== 'sqlite' && process.env.DATABASE_URL)) {
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
        }
      } catch (dbErr: any) {
        console.error(`\n❌ [POSTGRES] Error al verificar la Base de Datos: ${dbErr?.message || dbErr}\n`);
      }
    } else if (selectedDriver === 'supabase') {
      console.log(`\n✅ [SUPABASE] Cliente configurado para ${process.env.SUPABASE_URL}\n`);
    } else if (selectedDriver === 'sqlite') {
      console.log(`\n✅ [SQLITE] Base de datos local inicializada correctamente\n`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
