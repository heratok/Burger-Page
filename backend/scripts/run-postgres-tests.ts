import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function run(cmd: string, args: string[], options: { cwd?: string } = {}) {
  const isWindows = process.platform === 'win32';
  const proc = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: isWindows,
    cwd: options.cwd || process.cwd(),
    env: { ...process.env },
  });
  return proc.status ?? 1;
}

async function main() {
  console.log('\n🐘 Starting PostgreSQL Test Container via Docker Compose...\n');
  const rootDir = resolve(process.cwd());

  // Attempt to start docker compose
  const upStatus = run('docker', ['compose', 'up', '-d', '--wait', 'postgres-test'], { cwd: rootDir });

  if (upStatus !== 0) {
    console.warn('\n⚠️ Docker Compose could not start the container (Docker daemon might not be running).');
    if (process.env.DATABASE_URL) {
      console.log('ℹ️ DATABASE_URL is set — proceeding with external Postgres instance.\n');
    } else {
      console.error('❌ Error: Start Docker Desktop or provide a DATABASE_URL environment variable.\n');
      process.exit(1);
    }
  }

  let testStatus = 1;
  try {
    console.log('\n🧪 Running PostgreSQL Integration Test Suite...\n');
    testStatus = run('npx', ['vitest', 'run', 'tests/integration/postgres/PostgresConstraints.test.ts'], {
      cwd: resolve(rootDir, 'backend'),
    });
  } finally {
    if (upStatus === 0) {
      console.log('\n🧹 Tearing down PostgreSQL Test Container...\n');
      run('docker', ['compose', 'down', '-v'], { cwd: rootDir });
    }
  }

  process.exit(testStatus);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
