import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

function readSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.',
    );
  }

  return { url, anonKey };
}

/**
 * Returns the shared Supabase browser client.
 *
 * The client is created lazily so the app can build and render routes that do
 * not use Supabase before environment variables are configured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = readSupabaseConfig();
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
