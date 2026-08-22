import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCelebrationTemplates, type CelebrationTemplates } from "@/lib/celebrations";
import { getAgencyProfile, type AgencyProfile } from "@/lib/agency-profile";
import { CACHE_TAGS } from "@/lib/cache-tags";

// unstable_cache can't wrap the cookie-bound Supabase client (Next
// disallows request-scoped APIs like cookies() inside a cache scope), so
// every getter here uses the service-role admin client instead — safe only
// because each of these is agency-wide config/lookup data with no per-agent
// RLS split, not business data. Also wrapped in React's per-request cache()
// so multiple components calling the same getter in one render only pay
// the persisted-cache lookup once, not per call site.

export const getCelebrationTemplatesCached = cache(
  unstable_cache(
    async (): Promise<CelebrationTemplates> => {
      const admin = createAdminClient();
      return getCelebrationTemplates(admin as unknown as Parameters<typeof getCelebrationTemplates>[0]);
    },
    ["celebration-templates"],
    { revalidate: 3600, tags: [CACHE_TAGS.celebrationTemplates] },
  ),
);

// Read on every print (client/policy pages) and every outgoing email
// (manual and cron), so this is exactly the kind of small, rarely-changed,
// agency-wide config this cache layer exists for.
export const getAgencyProfileCached = cache(
  unstable_cache(
    async (): Promise<AgencyProfile> => {
      const admin = createAdminClient();
      return getAgencyProfile(admin as unknown as Parameters<typeof getAgencyProfile>[0]);
    },
    ["agency-profile"],
    { revalidate: 3600, tags: [CACHE_TAGS.agencyProfile] },
  ),
);

// ---------------------------------------------------------------------------
// Πίνακες φίλτρων (κανόνας 5, βλ. lib/list-page/window.ts)
//
// Κάθε σελίδα λίστας/αναφοράς ξεκινούσε με τρία ερωτήματα για να γεμίσει τα
// dropdown της: συνεργάτες, εταιρείες, κλάδοι. Μετρημένα ~200-500 ms η
// καθεμία από τη Vercel προς το Supabase — δηλαδή έως 1,5 δευτ. πριν καν
// αρχίσει η πραγματική δουλειά, σε ΚΑΘΕ άνοιγμα. Είναι ρυθμίσεις γραφείου
// που αλλάζουν ελάχιστες φορές τον χρόνο, οπότε μπαίνουν εδώ και
// ακυρώνονται ρητά από τις αντίστοιχες ενέργειες των Ρυθμίσεων.

export type LookupOption = { id: string; label: string };

export const getActiveAgentsCached = cache(
  unstable_cache(
    async (): Promise<LookupOption[]> => {
      const { data } = await createAdminClient()
        .from("agency_users")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      return (data ?? []).map((a) => ({ id: a.id, label: a.full_name }));
    },
    ["lookup-active-agents"],
    { revalidate: 3600, tags: [CACHE_TAGS.agencyUsers] },
  ),
);

// ΟΛΕΣ οι εταιρείες, όχι μόνο οι ενεργές: ένα παλιό συμβόλαιο μπορεί να
// ανήκει σε εταιρεία που απενεργοποιήθηκε, και το φίλτρο πρέπει να μπορεί
// ακόμα να τη βρει. Ίδιο με ό,τι έκαναν ήδη οι σελίδες inline.
export const getCarriersCached = cache(
  unstable_cache(
    async (): Promise<LookupOption[]> => {
      const { data } = await createAdminClient().from("carriers").select("id, name").order("name");
      return (data ?? []).map((c) => ({ id: c.id, label: c.name }));
    },
    ["lookup-carriers"],
    { revalidate: 3600, tags: [CACHE_TAGS.carriers] },
  ),
);

export const getInsuranceLinesCached = cache(
  unstable_cache(
    async (): Promise<LookupOption[]> => {
      const { data } = await createAdminClient()
        .from("insurance_lines")
        .select("id, name_el")
        .order("sort_order");
      return (data ?? []).map((l) => ({ id: l.id, label: l.name_el }));
    },
    ["lookup-insurance-lines"],
    { revalidate: 3600, tags: [CACHE_TAGS.insuranceLines] },
  ),
);

export const getPaymentMethodsCached = cache(
  unstable_cache(
    async (): Promise<{ id: string; name: string }[]> => {
      const { data } = await createAdminClient()
        .from("payment_methods")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
    ["lookup-payment-methods"],
    { revalidate: 3600, tags: [CACHE_TAGS.paymentMethods] },
  ),
);

