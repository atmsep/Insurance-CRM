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

// Anything paid beyond what was actually owed on the installment — shown
// as a "tip" note on the receipt instead of silently vanishing.
export function installmentTip(inst: InstallmentForMath): number {
  return Math.max((inst.paid_amount ?? 0) - inst.amount, 0);
}

export function installmentRemaining(inst: InstallmentForMath): number {
  return Math.max(inst.amount - (inst.paid_amount ?? 0), 0);
}

// "Issued and still relevant" — not a draft that never went out, not a
// policy that was itself cancelled. Used to decide which policies' unpaid
// balances should actually show up as owed.
export function isBillablePolicyStatus(status: string): boolean {
  return status !== "draft" && status !== "cancelled";
}

// "outstanding = premium_gross minus paid installments of the CURRENT
// movement", scoped to a given page of policies — used by the policies
// list and CSV export.
//
// A permanent policy accumulates one policy_movements row per billable
// event over its whole life (§2 of the Profia rebuild plan), each with its
// own installment(s) — summing every installment ever billed against
// policy_id (across years of renewals) against just the current
// premium_gross would be nonsense. So: policies with at least one movement
// only count the installments of their LATEST movement. Policies with no
// movement yet (either genuinely legacy pre-rebuild data, or a renewal
// chain that hasn't been renewed again since the rebuild shipped — see
// createPolicy) fall back to every installment directly on policy_id, the
// same as before this feature existed.
export async function getOutstandingByPolicy(
  supabase: SupabaseClient,
  policies: PolicyForBalance[],
): Promise<Map<string, number>> {
  const outstanding = new Map<string, number>();
  const billable = policies.filter((p) => isBillablePolicyStatus(p.status));
  if (billable.length === 0) return outstanding;

  const policyIds = billable.map((p) => p.id);

  const { data: movements } = await supabase
    .from("policy_movements")
    .select("id, policy_id, created_at")
    .in("policy_id", policyIds)
    .order("created_at", { ascending: false });

  const latestMovementByPolicy = new Map<string, string>();
  for (const m of movements ?? []) {
    if (!latestMovementByPolicy.has(m.policy_id)) latestMovementByPolicy.set(m.policy_id, m.id);
  }

  const movementPolicyIds = new Set(latestMovementByPolicy.keys());
  const legacyPolicyIds = policyIds.filter((id) => !movementPolicyIds.has(id));
  const movementIds = [...latestMovementByPolicy.values()];

  const paidByPolicy = new Map<string, number>();

  if (movementIds.length > 0) {
    const { data: movementInstallments } = await supabase
      .from("policy_installments")
      .select("movement_id, amount, paid_amount")
      .in("movement_id", movementIds);

    const movementToPolicy = new Map([...latestMovementByPolicy.entries()].map(([pid, mid]) => [mid, pid]));
    for (const i of movementInstallments ?? []) {
      const policyId = i.movement_id ? movementToPolicy.get(i.movement_id) : undefined;
      if (!policyId) continue;
      paidByPolicy.set(policyId, (paidByPolicy.get(policyId) ?? 0) + installmentApplied(i));
    }
  }

  if (legacyPolicyIds.length > 0) {
    const { data: legacyInstallments } = await supabase
      .from("policy_installments")
      .select("policy_id, amount, paid_amount")
      .is("movement_id", null)
      .in("policy_id", legacyPolicyIds);

    for (const i of legacyInstallments ?? []) {
      paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + installmentApplied(i));
    }
  }

  for (const p of billable) {
    outstanding.set(p.id, Math.max(p.premium_gross - (paidByPolicy.get(p.id) ?? 0), 0));
  }
  return outstanding;
}
