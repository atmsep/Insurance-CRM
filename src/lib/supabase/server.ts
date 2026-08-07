import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Components can't set cookies, so setAll is wrapped in try/catch.
// This is safe as long as proxy.ts refreshes the session on every request.
// Not typed with the Database generic — see lib/supabase/client.ts.
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
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; ignored because proxy.ts
            // refreshes the session on every request.
          }
        },
      },
    },
  );
}
