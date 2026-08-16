import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type PolicyForBalance = { id: string; status: string; premium_gross: number };

export type InstallmentForMath = {
  amount: number;
  paid_amount?: number | null;
};

// policy_installments.paid_amount is kept in sync with the active
// (non-reversed) total of its installment_payments transactions by a DB
// trigger (see migration 0045), so it's always accurate — capped at amount
// so a tip never masks as more premium collected. Still used by
// getOutstandingByPolicy below.
export function installmentApplied(inst: InstallmentForMath): number {
  return Math.min(inst.paid_amount ?? 0, inst.amount);
}

// "Issued and still relevant" — not a draft that never went out, not a
// policy that was itself cancelled. Used to decide which policies' unpaid
// balances should actually show up as owed.
export function isBillablePolicyStatus(status: string): boolean {
  return status !== "draft" && status !== "cancelled";
}

// "outstanding = premium_gross minus paid installments", scoped to a given
// page of policies — used by the policies list and CSV export.
export async function getOutstandingByPolicy(
  supabase: SupabaseClient,
  policies: PolicyForBalance[],
): Promise<Map<string, number>> {
  const outstanding = new Map<string, number>();
  const billable = policies.filter((p) => isBillablePolicyStatus(p.status));
  if (billable.length === 0) return outstanding;

  const { data: installments } = await supabase
    .from("policy_installments")
    .select("policy_id, amount, paid_amount")
    .in(
      "policy_id",
      billable.map((p) => p.id),
    );

  const paidByPolicy = new Map<string, number>();
  for (const i of installments ?? []) {
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + installmentApplied(i));
  }

  for (const p of billable) {
    outstanding.set(p.id, Math.max(p.premium_gross - (paidByPolicy.get(p.id) ?? 0), 0));
  }
  return outstanding;
}
