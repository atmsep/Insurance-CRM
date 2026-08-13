"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

export type ClientOutstandingInstallment = {
  id: string;
  policy_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
  policy_number: string;
};

// Mirrors getPolicyInstallments (policies/actions.ts) but scoped to a
// client across all of their (current-term) policies instead of a single
// policy. Originally a plain PostgREST embedded query (policies!inner +
// .eq("policies.client_id",...)) on the theory that a single-client result
// set would be cheap regardless — confirmed live that assumption was wrong:
// that query shape hit a real statement timeout (57014) under an
// authenticated session, because PostgREST's translation of the embedded
// filter defeats the planner's use of policies_client_idx (the equivalent
// hand-written SQL join runs in ~1ms). client_outstanding_installments
// (migration 0070) is that same hand-written join as a security-definer
// RPC instead.
export async function getClientOutstandingInstallments(clientId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const [{ data: installments }, { data: paymentMethods }] = await Promise.all([
    supabase.rpc("client_outstanding_installments", { p_client_id: clientId }) as unknown as Promise<{
      data: ClientOutstandingInstallment[] | null;
    }>,
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  return {
    installments: installments ?? [],
    paymentMethods: paymentMethods ?? [],
  };
}
