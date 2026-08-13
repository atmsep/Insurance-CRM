import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
export type CommissionsByStatusRow = {
  direction: "incoming" | "outgoing";
  status: string;
  commission_count: number;
  amount_sum: number;
};
export type ReferralBreakdownRow = { source: string; client_count: number };
export type CarrierSummaryRow = {
  carrier_id: string;
  carrier_name: string;
  collected: number;
  commission_total: number;
  commission_pending: number;
};

// Wrapped in React's per-request cache() so components that need the same
// RPC (e.g. the stats row and its matching table) only trigger one actual
// Supabase round-trip, even though each is its own Suspense boundary.
export const getPoliciesByStatus = cache(async (): Promise<PoliciesByStatusRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_policies_by_status")) as unknown as {
    data: PoliciesByStatusRow[] | null;
  };
  return data ?? [];
});

export const getPoliciesByLine = cache(async (): Promise<PoliciesByLineRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_policies_by_line")) as unknown as {
    data: PoliciesByLineRow[] | null;
  };
  return data ?? [];
});

export const getBillingSummary = cache(async (): Promise<BillingSummaryRow> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_billing_summary")) as unknown as {
    data: BillingSummaryRow[] | null;
  };
  return data?.[0] ?? { total_billed: 0, total_collected: 0, total_tips: 0, outstanding: 0 };
});

export const getClaimsByStatus = cache(async (): Promise<ClaimsByStatusRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_claims_by_status")) as unknown as {
    data: ClaimsByStatusRow[] | null;
  };
  return data ?? [];
});

export const getCommissionsByStatus = cache(async (): Promise<CommissionsByStatusRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_commissions_by_status")) as unknown as {
    data: CommissionsByStatusRow[] | null;
  };
  return data ?? [];
});

export const getReferralBreakdown = cache(async (): Promise<ReferralBreakdownRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_referral_breakdown")) as unknown as {
    data: ReferralBreakdownRow[] | null;
  };
  return data ?? [];
});

export const getCarrierSummary = cache(async (): Promise<CarrierSummaryRow[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("report_carrier_summary")) as unknown as {
    data: CarrierSummaryRow[] | null;
  };
  return data ?? [];
});
