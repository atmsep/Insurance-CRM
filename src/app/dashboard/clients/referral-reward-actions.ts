"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import type { ReferralRewardCalcType } from "@/lib/database.types";
import { logActivity } from "@/lib/activity-log";

export async function saveReferralReward(
  referrerClientId: string,
  referredClientId: string,
  policyId: string,
  movementId: string | null,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const calcType = formData.get("calc_type") as ReferralRewardCalcType;
  if (calcType !== "percent" && calcType !== "fixed") {
    return { error: "Μη έγκυρος τύπος υπολογισμού." };
  }

  // Re-fetch the base premium server-side — never trust a client-supplied
  // base amount, since a stale tab or a tampered request could otherwise
  // set an arbitrary reward base. A movement-keyed reward (the policy has
  // at least one policy/renewal movement) uses that movement's own
  // premium; a policy with no movement yet (pre-dates policy_movements)
  // falls back to the policy's own premium, exactly as before.
  let baseAmount: number;
  if (movementId) {
    const { data: movement } = await supabase
      .from("policy_movements")
      .select("id, policy_id, premium_net, policies!inner(client_id)")
      .eq("id", movementId)
      .single();
    const movementPolicy = movement?.policies as unknown as { client_id: string } | null;
    if (!movement || movement.policy_id !== policyId || movementPolicy?.client_id !== referredClientId) {
      return { error: "Η κίνηση δεν βρέθηκε." };
    }
    baseAmount = movement.premium_net ?? 0;
  } else {
    const { data: policy } = await supabase
      .from("policies")
      .select("id, client_id, premium_net")
      .eq("id", policyId)
      .single();

    if (!policy || policy.client_id !== referredClientId) {
      return { error: "Το συμβόλαιο δεν βρέθηκε." };
    }
    baseAmount = policy.premium_net ?? 0;
  }

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

  const existingQuery = movementId
    ? supabase.from("referral_rewards").select("id, paid_at").eq("policy_movement_id", movementId)
    : supabase.from("referral_rewards").select("id, paid_at").eq("policy_id", policyId).is("policy_movement_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  // Same auto-stamp semantics as before: set paid_at the first time status
  // becomes "paid", keep it stable on re-saves while still "paid", clear it
  // if the status moves away from "paid".
  const paidAt = status === "paid" ? (existing?.paid_at ?? new Date().toISOString()) : null;

  const payload = {
    referrer_client_id: referrerClientId,
    referred_client_id: referredClientId,
    policy_id: policyId,
    policy_movement_id: movementId,
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
// Reads here are gated entirely by requireAdmin() below, then run on the
// admin client instead of the regular RLS-enforced one — the "eligible
// candidates" queries filter on a *joined* table's column
// (clients.referred_by_client_id / policies.clients.referred_by_client_id),
// and this schema has repeatedly hung under RLS for exactly that shape of
// query (same root cause as the report_* functions fixed in migration
// 0095, and the reason the Ταμείο rebuild deliberately avoided it too).
// Confirmed live: the legacy-policies query alone took ~3.6s under RLS on
// a near-empty test dataset — unusable at real data volume.
export async function setDefaultReferralRewardRule(
  currentClientId: string,
  formData: FormData,
): Promise<{ error: string } | { count: number }> {
  const agencyUser = await requireAdmin();
  const supabase = createAdminClient();

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

  const computeReward = (baseAmount: number) =>
    calcType === "percent"
      ? Math.round(((baseAmount * (ratePercent ?? 0)) / 100) * 100) / 100
      : (fixedAmount ?? 0);

  // "Eligible" means no reward yet, or an existing one that's still "auto"
  // (never touch a human-edited "manual" one). Since migration 0082 dropped
  // the old unique(policy_id), PostgREST now embeds referral_rewards as an
  // array everywhere (even though at most one row is possible per key in
  // practice) — always read it as such, never as a single object.
  const isEligible = (rewards: { source: string }[] | null | undefined) =>
    !rewards || rewards.length === 0 || rewards[0].source === "auto";

  // Movement-keyed candidates: every reward-eligible movement (new business
  // or renewal — the only kinds createMovementForPolicy is ever called
  // with) belonging to one of this referrer's referred clients' policies.
  const { data: movementCandidates, error: movementFetchError } = await supabase
    .from("policy_movements")
    .select(
      "id, premium_net, policy_id, policies!inner(id, client_id, clients!inner(referred_by_client_id)), referral_rewards(source)",
    )
    .in("kind", ["policy", "renewal"])
    .eq("policies.clients.referred_by_client_id", currentClientId);

  if (movementFetchError) {
    return { error: "Σφάλμα κατά την ανάκτηση κινήσεων: " + movementFetchError.message };
  }

  type MovementCandidate = {
    id: string;
    premium_net: number | null;
    policy_id: string;
    policies: { id: string; client_id: string } | null;
    referral_rewards: { source: string }[] | null;
  };

  const allMovements = (movementCandidates ?? []) as unknown as MovementCandidate[];
  const eligibleMovements = allMovements.filter((m) => isEligible(m.referral_rewards));
  const policiesWithMovements = new Set(allMovements.map((m) => m.policy_id));

  // Legacy fallback: referred clients' policies that don't have any
  // movement yet at all (pre-dates the policy_movements feature, never
  // renewed since it shipped) — same per-policy reward this always was.
  const { data: legacyCandidates, error: legacyFetchError } = await supabase
    .from("policies")
    .select("id, premium_net, clients!inner(id, referred_by_client_id), referral_rewards(source)")
    .eq("clients.referred_by_client_id", currentClientId);

  if (legacyFetchError) {
    return { error: "Σφάλμα κατά την ανάκτηση συμβολαίων: " + legacyFetchError.message };
  }

  type LegacyCandidate = {
    id: string;
    premium_net: number | null;
    clients: { id: string; referred_by_client_id: string } | null;
    referral_rewards: { source: string }[] | null;
  };

  const eligibleLegacy = ((legacyCandidates ?? []) as unknown as LegacyCandidate[]).filter(
    (p) => !policiesWithMovements.has(p.id) && isEligible(p.referral_rewards),
  );

  if (eligibleMovements.length === 0 && eligibleLegacy.length === 0) {
    revalidatePath(`/dashboard/clients/${currentClientId}`);
    return { count: 0 };
  }

  // Both "one reward per key" rules are partial unique indexes (a policy_id
  // can carry several movement-keyed rows, so neither index covers the
  // plain column alone) — Postgres can't use a partial index as an
  // ON CONFLICT arbiter for a plain upsert, so this checks for an existing
  // row and inserts or updates explicitly instead, the same way
  // saveReferralReward already does for a single row.
  if (eligibleMovements.length > 0) {
    const { data: existingRows } = await supabase
      .from("referral_rewards")
      .select("id, policy_movement_id")
      .in(
        "policy_movement_id",
        eligibleMovements.map((m) => m.id),
      );
    const existingByMovement = new Map((existingRows ?? []).map((r) => [r.policy_movement_id, r.id]));

    for (const m of eligibleMovements) {
      const baseAmount = m.premium_net ?? 0;
      const payload = {
        referrer_client_id: currentClientId,
        referred_client_id: m.policies!.client_id,
        policy_id: m.policy_id,
        policy_movement_id: m.id,
        calc_type: calcType,
        rate_percent: ratePercent,
        fixed_amount: fixedAmount,
        base_amount: baseAmount,
        reward_amount: computeReward(baseAmount),
        status: "pending" as const,
        paid_at: null,
        source: "auto" as const,
        created_by: agencyUser.id,
      };
      const existingId = existingByMovement.get(m.id);
      const { error } = existingId
        ? await supabase.from("referral_rewards").update(payload).eq("id", existingId)
        : await supabase.from("referral_rewards").insert(payload);
      if (error) return { error: "Σφάλμα κατά την εφαρμογή: " + error.message };
    }
  }

  if (eligibleLegacy.length > 0) {
    const { data: existingRows } = await supabase
      .from("referral_rewards")
      .select("id, policy_id")
      .in(
        "policy_id",
        eligibleLegacy.map((p) => p.id),
      )
      .is("policy_movement_id", null);
    const existingByPolicy = new Map((existingRows ?? []).map((r) => [r.policy_id, r.id]));

    for (const p of eligibleLegacy) {
      const baseAmount = p.premium_net ?? 0;
      const payload = {
        referrer_client_id: p.clients!.referred_by_client_id,
        referred_client_id: p.clients!.id,
        policy_id: p.id,
        calc_type: calcType,
        rate_percent: ratePercent,
        fixed_amount: fixedAmount,
        base_amount: baseAmount,
        reward_amount: computeReward(baseAmount),
        status: "pending" as const,
        paid_at: null,
        source: "auto" as const,
        created_by: agencyUser.id,
      };
      const existingId = existingByPolicy.get(p.id);
      const { error } = existingId
        ? await supabase.from("referral_rewards").update(payload).eq("id", existingId)
        : await supabase.from("referral_rewards").insert(payload);
      if (error) return { error: "Σφάλμα κατά την εφαρμογή: " + error.message };
    }
  }

  revalidatePath(`/dashboard/clients/${currentClientId}`);
  return { count: eligibleMovements.length + eligibleLegacy.length };
}
