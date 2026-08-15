import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Shapes returned by the report_* SQL functions (migration 0055) — not in
// database.types.ts, which doesn't model custom functions, so each getter
// needs an explicit generic instead of relying on inference.
export type PoliciesByStatusRow = { status: string; policy_count: number; premium_sum: number };
export type PoliciesByLineRow = { line_name: string; policy_count: number; premium_sum: number };
export type BillingSummaryRow = {
  total_billed: number;
  total_collected: number;
  total_tips: number;
  outstanding: number;
};
export type ClaimsByStatusRow = { status: string; claim_count: number; amount_sum: number };
export type ReferralBreakdownRow = { source: string; client_count: number };

// These RPCs are whole-agency aggregates (reports/page.tsx already
// redirects non-owner/admin away before any of this runs — there's no
// per-agent scoping to lose by going through the admin client, unlike the
// dashboard's per-agent stat tiles). unstable_cache can't wrap the
// cookie-bound client (cookies() isn't allowed inside a cache scope), so
// these use createAdminClient() + a 60s revalidate, tagged "reports" so
// collectInstallmentPayment/commission/claim actions can invalidate them
// immediately via updateTag instead of waiting out the window. Wrapped in
// React's cache() too so the stats row and a table card that need the same
// RPC in one render only pay the persisted-cache lookup once.

export const getPoliciesByStatus = cache(
  unstable_cache(
    async (): Promise<PoliciesByStatusRow[]> => {
      const admin = createAdminClient();
      const { data } = (await admin.rpc("report_policies_by_status")) as unknown as {
        data: PoliciesByStatusRow[] | null;
      };
      return data ?? [];
    },
    ["report-policies-by-status"],
    { revalidate: 60, tags: [CACHE_TAGS.reports] },
  ),
);

export const getPoliciesByLine = cache(
  unstable_cache(
    async (): Promise<PoliciesByLineRow[]> => {
      const admin = createAdminClient();
      const { data } = (await admin.rpc("report_policies_by_line")) as unknown as {
        data: PoliciesByLineRow[] | null;
      };
      return data ?? [];
    },
    ["report-policies-by-line"],
    { revalidate: 60, tags: [CACHE_TAGS.reports] },
  ),
);

export const getBillingSummary = cache(
  unstable_cache(
    async (): Promise<BillingSummaryRow> => {
      const admin = createAdminClient();
      const { data } = (await admin.rpc("report_billing_summary")) as unknown as {
        data: BillingSummaryRow[] | null;
      };
      return data?.[0] ?? { total_billed: 0, total_collected: 0, total_tips: 0, outstanding: 0 };
    },
    ["report-billing-summary"],
    { revalidate: 60, tags: [CACHE_TAGS.reports] },
  ),
);

export const getClaimsByStatus = cache(
  unstable_cache(
    async (): Promise<ClaimsByStatusRow[]> => {
      const admin = createAdminClient();
      const { data } = (await admin.rpc("report_claims_by_status")) as unknown as {
        data: ClaimsByStatusRow[] | null;
      };
      return data ?? [];
    },
    ["report-claims-by-status"],
    { revalidate: 60, tags: [CACHE_TAGS.reports] },
  ),
);

export const getReferralBreakdown = cache(
  unstable_cache(
    async (): Promise<ReferralBreakdownRow[]> => {
      const admin = createAdminClient();
      const { data } = (await admin.rpc("report_referral_breakdown")) as unknown as {
        data: ReferralBreakdownRow[] | null;
      };
      return data ?? [];
    },
    ["report-referral-breakdown"],
    { revalidate: 60, tags: [CACHE_TAGS.reports] },
  ),
);
