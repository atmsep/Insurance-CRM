import { createBrowserClient } from "@supabase/ssr";

// Not typed with the Database generic: our hand-written types in
// database.types.ts don't match supabase-js's strict generic contract
// (Relationships, Views, Functions, ...). Replace with
// `supabase gen types typescript` output once the Supabase CLI is linked.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
