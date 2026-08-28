import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
}

let cachedClient: SupabaseClient | null = null;

export function createSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  const url = config?.supabaseUrl || process.env.SUPABASE_URL;
  const key =
    config?.supabaseKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase client requires SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) to be defined.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient(config);
  }
  return cachedClient;
}
