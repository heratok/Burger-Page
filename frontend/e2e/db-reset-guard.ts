/**
 * Safety guard for the E2E database reset.
 *
 * The reset DROPS the target database. Doppler `dev` and `prd` share the
 * production Supabase database, so this guard is deliberately strict and
 * never falls back: anything that is not clearly a local throwaway database
 * throws, which fails the whole run before a single statement is executed.
 */

export const ALLOWED_DATABASES = ['burger_page_dev', 'burger_page_test'] as const;

const ALLOWED_PROTOCOLS = ['postgres:', 'postgresql:'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];
const CLOUD_MARKERS = ['supabase', 'pooler', 'amazonaws', 'render'];

export interface ResetTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const refuse = (reason: string): never => {
  throw new Error(`Refusing to reset the E2E database: ${reason}`);
};

export function assertSafeToReset(rawUrl: string | undefined): ResetTarget {
  if (!rawUrl || rawUrl.trim() === '') {
    return refuse('no database URL is configured (set backend/.env DATABASE_URL or E2E_DATABASE_URL).');
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return refuse('the database URL is not a valid URL.');
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    refuse(`protocol "${url.protocol}" is not postgres/postgresql.`);
  }

  // URL keeps the brackets on IPv6 hosts ("[::1]").
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!LOCAL_HOSTS.includes(host)) {
    refuse(`host "${host}" is not localhost, 127.0.0.1 or ::1.`);
  }

  const lowered = rawUrl.toLowerCase();
  const marker = CLOUD_MARKERS.find((m) => lowered.includes(m));
  if (marker) {
    refuse(`the URL contains the cloud marker "${marker}".`);
  }

  if (url.searchParams.get('sslmode')?.toLowerCase() === 'require') {
    refuse('sslmode=require points at a managed database.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!(ALLOWED_DATABASES as readonly string[]).includes(database)) {
    refuse(`database "${database}" is not in the allowlist (${ALLOWED_DATABASES.join(', ')}).`);
  }

  return {
    host,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}
