import pg from 'pg';

const { Client } = pg;

export const ADMIN_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';

/**
 * Creates (or recreates) a throwaway database next to the test one and returns
 * a connected client plus a cleanup function. Returns null when the server is
 * not reachable so the caller can skip, like the other integration suites.
 */
export async function createScratchDb(name: string): Promise<{ db: pg.Client; drop: () => Promise<void> } | null> {
  const admin = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
  try {
    await admin.connect();
  } catch (err: any) {
    console.warn(`\n[scratch DB ${name}] Skipping: ${err.message}`);
    return null;
  }
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  const db = new Client({ connectionString: ADMIN_URL.replace(/\/[^/]+$/, `/${name}`) });
  await db.connect();
  return {
    db,
    drop: async () => {
      await db.end().catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => {});
      await admin.end().catch(() => {});
    },
  };
}
