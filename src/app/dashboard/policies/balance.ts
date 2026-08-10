import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type PolicyForBalance = { id: string; status: string; premium_gross: number };

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
    .select("policy_id, amount")
    .in(
      "policy_id",
      billable.map((p) => p.id),
    )
    .eq("status", "paid");

  const paidByPolicy = new Map<string, number>();
  for (const i of installments ?? []) {
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + i.amount);
  }

  for (const p of billable) {
    outstanding.set(p.id, Math.max(p.premium_gross - (paidByPolicy.get(p.id) ?? 0), 0));
  }
  return outstanding;
}
