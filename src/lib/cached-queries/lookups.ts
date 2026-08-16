import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCelebrationTemplates, type CelebrationTemplates } from "@/lib/celebrations";
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

