import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve repo-relative paths from the script location, not process.cwd():
// this script is invoked both from the repo root (npm run
// test:integration:postgres) and from backend/ (npm --prefix backend run
// test:integration:postgres), and cwd-relative resolution broke the vitest
// spawn (ENOENT, silent exit 1) when run from backend/.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, '..');
const repoRoot = resolve(backendDir, '..');

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
  console.log('\n🐘 Running PostgreSQL Integration Tests...\n');
  // SKIP_COMPOSE=1: the Postgres service is provided externally (e.g. a CI
  // service container) — never touch docker compose, only use DATABASE_URL.
  const skipCompose = process.env.SKIP_COMPOSE === '1';

  let upStatus = 0;
  if (skipCompose) {
    if (!process.env.DATABASE_URL) {
      console.error('❌ Error: SKIP_COMPOSE=1 requires a DATABASE_URL environment variable.\n');
      process.exit(1);
    }
    console.log('ℹ️ SKIP_COMPOSE=1 — using the DATABASE_URL-provided Postgres instance (no compose lifecycle).');
  } else {
    console.log('🐳 Starting PostgreSQL Test Container via Docker Compose...\n');
    upStatus = run('docker', ['compose', 'up', '-d', '--wait', 'postgres-test'], { cwd: repoRoot });

    if (upStatus !== 0) {
      console.warn('\n⚠️ Docker Compose could not start the container (Docker daemon might not be running).');
      if (process.env.DATABASE_URL) {
        console.log('ℹ️ DATABASE_URL is set — proceeding with external Postgres instance.\n');
      } else {
        console.error('❌ Error: Start Docker Desktop or provide a DATABASE_URL environment variable.\n');
        process.exit(1);
      }
    }
  }

  let testStatus = 1;
  try {
    console.log('\n🧪 Running PostgreSQL Integration Test Suite (tests/integration/postgres/)...\n');
    // --fileParallelism=false: PostgresConstraints.test.ts re-applies
    // database/01_schema.sql (DROP/CREATE POLICY = ACCESS EXCLUSIVE locks)
    // while other files run DML. Server logs proved that with parallel files
    // the reapply can hold two tables' ACE locks at once (the intermediate
    // COMMITs in the schema are no-ops in the multi-statement driver
    // transport) and deadlock against concurrent FK-pre-check INSERTs — a
    // flaky failure that moved between suites depending on timing. Running
    // the files serially makes the reapply never overlap in-flight DML.
    testStatus = run('npx', ['vitest', 'run', '--fileParallelism=false', 'tests/integration/postgres/'], {
      cwd: backendDir,
    });
  } finally {
    if (!skipCompose && upStatus === 0) {
      console.log('\n🧹 Tearing down PostgreSQL Test Container...\n');
      run('docker', ['compose', 'down', '-v'], { cwd: repoRoot });
    }
  }

  process.exit(testStatus);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
