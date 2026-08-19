import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type AgencyProfile = {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
};

const EMPTY_PROFILE: AgencyProfile = { name: null, address: null, phone: null, email: null, logoUrl: null };

// Used both from Server Components (settings tab, print letterhead) and
// from sendEmail() — including from cron routes, which run outside a React
// render, so this takes a plain client rather than assuming React's per-
// request context. See src/lib/cached-queries/lookups.ts for the cached
// wrapper every call site should actually use instead of this directly.
export async function getAgencyProfile(supabase: SupabaseClient): Promise<AgencyProfile> {
  const { data } = await supabase
    .from("agency_profile")
    .select("name, address, phone, email, logo_storage_path")
    .eq("key", "default")
    .maybeSingle();

  if (!data) return EMPTY_PROFILE;

  const logoUrl = data.logo_storage_path
    ? supabase.storage.from("agency-assets").getPublicUrl(data.logo_storage_path).data.publicUrl
    : null;

  return {
    name: data.name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    logoUrl,
  };
}
