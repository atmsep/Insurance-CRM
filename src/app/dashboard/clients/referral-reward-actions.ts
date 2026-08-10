"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { ReferralRewardCalcType } from "@/lib/database.types";
import { logActivity } from "@/lib/activity-log";

export async function saveReferralReward(
  referrerClientId: string,
  referredClientId: string,
  policyId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const calcType = formData.get("calc_type") as ReferralRewardCalcType;
  if (calcType !== "percent" && calcType !== "fixed") {
    return { error: "Μη έγκυρος τύπος υπολογισμού." };
  }

  // Re-fetch premium_net server-side — never trust a client-supplied base
  // amount, since a stale tab or a tampered request could otherwise set an
  // arbitrary reward base.
  const { data: policy } = await supabase
    .from("policies")
    .select("id, client_id, premium_net")
    .eq("id", policyId)
    .single();

  if (!policy || policy.client_id !== referredClientId) {
    return { error: "Το συμβόλαιο δεν βρέθηκε." };
  }
  const baseAmount = policy.premium_net ?? 0;

  let ratePercent: number | null = null;
  let fixedAmount: number | null = null;
  let rewardAmount: number;

  if (calcType === "percent") {
    const rate = Number(formData.get("rate_percent"));
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: "Το ποσοστό δεν είναι έγκυρο." };
    }
    ratePercent = rate;
    rewardAmount = Math.round(((baseAmount * rate) / 100) * 100) / 100;
  } else {
    const amount = Number(formData.get("fixed_amount"));
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: "Το ποσό δεν είναι έγκυρο." };
    }
    fixedAmount = amount;
    rewardAmount = amount;
  }

  const status = (formData.get("status") as string) || "pending";
  const notes = (formData.get("notes") as string) || null;

  const { data: existing } = await supabase
    .from("referral_rewards")
    .select("id, paid_at")
    .eq("policy_id", policyId)
    .maybeSingle();

  // Same auto-stamp semantics as before: set paid_at the first time status
  // becomes "paid", keep it stable on re-saves while still "paid", clear it
  // if the status moves away from "paid".
  const paidAt = status === "paid" ? (existing?.paid_at ?? new Date().toISOString()) : null;

  const payload = {
    referrer_client_id: referrerClientId,
    referred_client_id: referredClientId,
    policy_id: policyId,
    calc_type: calcType,
    rate_percent: ratePercent,
    fixed_amount: fixedAmount,
    base_amount: baseAmount,
    reward_amount: rewardAmount,
    status: status as "pending" | "paid" | "cancelled",
    paid_at: paidAt,
    notes,
    // Any save through this per-policy form is a human decision — mark it
    // "manual" so a future default-rule apply never overwrites it.
    source: "manual" as const,
  };

  const { error } = existing
    ? await supabase.from("referral_rewards").update(payload).eq("id", existing.id)
    : await supabase.from("referral_rewards").insert({ ...payload, created_by: agencyUser.id });

  if (error) {
    return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };
  }

  await logActivity(supabase, {
    entityType: "client",
    entityId: referredClientId,
    action: "referral_reward_updated",
    description: "Ενημερώθηκε η ανταπόδοση σύστασης.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${referrerClientId}`);
  revalidatePath(`/dashboard/clients/${referredClientId}`);
}

async function requireAdmin() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    throw new Error("Δεν έχεις δικαίωμα για αυτή την ενέργεια.");
  }
  return agencyUser;
}

// Sets this referrer's default rule and immediately applies it to every
// policy of clients THEY referred that doesn't already carry a
// manually-set reward (source = "manual") — those are never touched, and
// other referrers' referrals are untouched too. Policies already carrying
// an "auto" reward get their amount refreshed to the new rule; policies
// with no reward yet get one created. Safe to re-run any time (e.g. after
// new policies show up) since it always just fills the gaps.
export async function setDefaultReferralRewardRule(
  currentClientId: string,
  formData: FormData,
): Promise<{ error: string } | { count: number }> {
  const agencyUser = await requireAdmin();
  const supabase = await createSupabaseClient();

  const calcType = formData.get("calc_type") as ReferralRewardCalcType;
  if (calcType !== "percent" && calcType !== "fixed") {
    return { error: "Μη έγκυρος τύπος υπολογισμού." };
  }

  let ratePercent: number | null = null;
  let fixedAmount: number | null = null;

  if (calcType === "percent") {
    const rate = Number(formData.get("rate_percent"));
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: "Το ποσοστό δεν είναι έγκυρο." };
    }
    ratePercent = rate;
  } else {
    const amount = Number(formData.get("fixed_amount"));
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: "Το ποσό δεν είναι έγκυρο." };
    }
    fixedAmount = amount;
  }

  const { error: ruleError } = await supabase.from("referral_reward_default_rule").upsert({
    referrer_client_id: currentClientId,
    calc_type: calcType,
    rate_percent: ratePercent,
    fixed_amount: fixedAmount,
    updated_by: agencyUser.id,
  });
  if (ruleError) {
    return { error: "Σφάλμα κατά την αποθήκευση του κανόνα: " + ruleError.message };
  }

  // Only this referrer's own referred clients' policies — a rule set on
  // one referrer's page never touches another referrer's referrals.
  const { data: candidates, error: fetchError } = await supabase
    .from("policies")
    .select("id, premium_net, clients!inner(id, referred_by_client_id), referral_rewards(source)")
    .eq("clients.referred_by_client_id", currentClientId);

  if (fetchError) {
    return { error: "Σφάλμα κατά την ανάκτηση συμβολαίων: " + fetchError.message };
  }

  type Candidate = {
    id: string;
    premium_net: number | null;
    clients: { id: string; referred_by_client_id: string } | null;
    referral_rewards: { source: string } | null;
  };

  const eligible = ((candidates ?? []) as unknown as Candidate[]).filter(
    (p) => !p.referral_rewards || p.referral_rewards.source === "auto",
  );

  if (eligible.length === 0) {
    revalidatePath(`/dashboard/clients/${currentClientId}`);
    return { count: 0 };
  }

  const rows = eligible.map((p) => {
    const baseAmount = p.premium_net ?? 0;
    const rewardAmount =
      calcType === "percent"
        ? Math.round(((baseAmount * (ratePercent ?? 0)) / 100) * 100) / 100
        : (fixedAmount ?? 0);
    return {
      referrer_client_id: p.clients!.referred_by_client_id,
      referred_client_id: p.clients!.id,
      policy_id: p.id,
      calc_type: calcType,
      rate_percent: ratePercent,
      fixed_amount: fixedAmount,
      base_amount: baseAmount,
      reward_amount: rewardAmount,
      status: "pending" as const,
      paid_at: null,
      source: "auto" as const,
      created_by: agencyUser.id,
    };
  });

  const { error: upsertError } = await supabase
    .from("referral_rewards")
    .upsert(rows, { onConflict: "policy_id" });

  if (upsertError) {
    return { error: "Σφάλμα κατά την εφαρμογή: " + upsertError.message };
  }

  revalidatePath(`/dashboard/clients/${currentClientId}`);
  return { count: rows.length };
}
