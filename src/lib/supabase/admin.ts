import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses the service_role key, which bypasses RLS entirely — only import this
// from Server Actions/Route Handlers that have already checked the caller is
// owner/admin. The `server-only` import makes any accidental client-side
// import a build error instead of a leaked secret.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
