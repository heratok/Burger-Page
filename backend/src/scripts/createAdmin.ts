import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Automatically load .env file
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
      // Continue searching
    }
  }
}

import { CryptoPasswordHasher } from '../infrastructure/security/CryptoPasswordHasher.js';
import { SupabaseUserRepository } from '../infrastructure/persistence/supabase/SupabaseUserRepository.js';
import { getSupabaseClient } from '../infrastructure/persistence/supabase/SupabaseClient.js';

async function main() {
  console.log('\n🔐 === Creador de Super Administrador (Burger-Page) ===\n');

  const rl = readline.createInterface({ input, output });

  let username = process.argv[2];
  let password = process.argv[3];

  if (!username) {
    username = await rl.question('👤 Ingresa el nombre de usuario admin: ');
  }
  if (!password) {
    password = await rl.question('🔑 Ingresa la contraseña: ');
  }

  rl.close();

  username = username.trim();
  password = password.trim();

  if (!username || !password) {
    console.error('❌ Error: El usuario y la contraseña no pueden estar vacíos.');
    process.exit(1);
  }

  const hasher = new CryptoPasswordHasher();
  const passwordHash = await hasher.hash(password);
  const userId = `usr_${randomUUID()}`;
  const now = new Date().toISOString();

  console.log('\n⚙️  Generando credenciales y hash criptográfico (scrypt)...');
  console.log(`- ID: ${userId}`);
  console.log(`- Usuario: ${username}`);
  console.log(`- Hash: ${passwordHash}\n`);

  // Intentar guardar directamente si las variables de entorno de Supabase existen
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    try {
      console.log('📡 Conectando con Supabase para insertar el usuario...');
      const client = getSupabaseClient();
      const userRepo = new SupabaseUserRepository(client);

      await userRepo.save({
        id: userId,
        username,
        passwordHash,
        role: 'super_admin',
        createdAt: now,
      });

      console.log('✅ ¡Super Administrador creado exitosamente en la base de datos de Supabase!');
      return;
    } catch (err: any) {
      console.warn(`⚠️ No se pudo insertar directamente en Supabase: ${err.message}`);
    }
  }

  console.log('📋 Puedes copiar y pegar esta consulta SQL directamente en el SQL Editor de Supabase:\n');
  console.log('--------------------------------------------------------------------------------');
  console.log(`INSERT INTO public.users (id, username, password_hash, role, is_active, created_at, updated_at)`);
  console.log(`VALUES ('${userId}', '${username}', '${passwordHash}', 'super_admin', true, NOW(), NOW())`);
  console.log(`ON CONFLICT (username) DO UPDATE SET password_hash = '${passwordHash}', updated_at = NOW();`);
  console.log('--------------------------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
