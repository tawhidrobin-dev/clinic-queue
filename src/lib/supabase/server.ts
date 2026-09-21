import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase server client — use inside:
 *   - Server Components
 *   - Server Actions
 *   - Route Handlers (app/api/...)
 *
 * Reads/writes auth cookies via next/headers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware handles token refresh.
          }
        },
      },
    },
  );
}

/**
 * Supabase admin client — bypasses RLS.
 * Use ONLY in trusted server contexts (webhooks, cron jobs, admin routes).
 * NEVER expose the service role key to the browser.
 */
export function createAdminClient() {
  // Lazy import to avoid bundling into client code
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
