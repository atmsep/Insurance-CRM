import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type PolicyForBalance = { id: string; status: string; premium_gross: number };

export type InstallmentForMath = {
  amount: number;
  status: string;
  paid_amount?: number | null;
};

// A single installment row holds the running total ever collected on it in
// paid_amount, which can land under, over, or exactly on `amount` — these
// three helpers turn that one number into the three figures the UI/reports
// actually need: how much of it counts toward the premium (capped at
// amount, so a tip never masks as more premium collected), how much is a
// tip (the part above amount), and how much is still owed.
export function installmentApplied(inst: InstallmentForMath): number {
  if (inst.status !== "paid" && inst.status !== "partially_paid") return 0;
  return Math.min(inst.paid_amount ?? 0, inst.amount);
}

export function installmentTip(inst: InstallmentForMath): number {
  if (inst.status !== "paid" && inst.status !== "partially_paid") return 0;
  return Math.max((inst.paid_amount ?? 0) - inst.amount, 0);
}

export function installmentRemaining(inst: InstallmentForMath): number {
  if (inst.status === "pending" || inst.status === "overdue") return inst.amount;
  if (inst.status === "partially_paid") return Math.max(inst.amount - (inst.paid_amount ?? 0), 0);
  return 0;
}

// Same "outstanding = premium_gross minus paid installments" rule used on
// the client detail page's Οικονομική εικόνα card, scoped here to a given
// page of policies instead of one client's policies.
export async function getOutstandingByPolicy(
  supabase: SupabaseClient,
  policies: PolicyForBalance[],
): Promise<Map<string, number>> {
  const outstanding = new Map<string, number>();
  const billable = policies.filter((p) => p.status !== "draft" && p.status !== "cancelled");
  if (billable.length === 0) return outstanding;

  const { data: installments } = await supabase
    .from("policy_installments")
    .select("policy_id, amount, status, paid_amount")
    .in(
      "policy_id",
      billable.map((p) => p.id),
    )
    .in("status", ["paid", "partially_paid"]);

  const paidByPolicy = new Map<string, number>();
  for (const i of installments ?? []) {
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + installmentApplied(i));
  }

  for (const p of billable) {
    outstanding.set(p.id, Math.max(p.premium_gross - (paidByPolicy.get(p.id) ?? 0), 0));
  }
  return outstanding;
}
