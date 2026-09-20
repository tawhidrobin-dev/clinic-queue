import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client — use inside Client Components.
 * Manages auth session via cookies automatically.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
