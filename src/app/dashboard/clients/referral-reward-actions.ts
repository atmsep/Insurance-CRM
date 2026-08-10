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
