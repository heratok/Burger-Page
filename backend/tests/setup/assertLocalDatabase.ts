// Guards every test run against writing into a real database.
// Postgres integration tests insert fixtures and even re-apply
// database/01_schema.sql, so a DATABASE_URL loaded from a production
// environment (e.g. Doppler) would pollute or rewrite production.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', 'postgres', 'postgres-test']);

export function assertLocalDatabaseUrl(name: string, url: string | undefined): void {
  if (!url) return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`${name} is not a valid URL; refusing to run tests against it.`);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `${name} points to non-local host "${hostname}"; refusing to run tests against a remote database.`,
    );
  }
}

assertLocalDatabaseUrl('DATABASE_URL', process.env.DATABASE_URL);
assertLocalDatabaseUrl('APP_USER_DATABASE_URL', process.env.APP_USER_DATABASE_URL);
