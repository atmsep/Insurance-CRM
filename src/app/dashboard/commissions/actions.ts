"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { CommissionDirection, CommissionType } from "@/lib/database.types";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

export async function createCommission(policyId: string, carrierId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const agentId = str(formData, "agent_id") ?? agencyUser.id;
  const commissionType = (str(formData, "commission_type") ?? "new_business") as CommissionType;
  const direction = (str(formData, "direction") ?? "incoming") as CommissionDirection;
  const payeeId = str(formData, "payee_id");

  if (direction === "outgoing" && !payeeId) {
    return { error: "Επίλεξε δικαιούχο για εξερχόμενη προμήθεια." };
  }

  await supabase.from("commissions").insert({
    policy_id: policyId,
    agent_id: agentId,
    carrier_id: carrierId,
    commission_type: commissionType,
    direction,
    payee_id: direction === "outgoing" ? payeeId : null,
    base_amount: num(formData, "base_amount"),
    commission_rate_percent: num(formData, "commission_rate_percent"),
    commission_amount: num(formData, "commission_amount") ?? 0,
    period: str(formData, "period"),
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
}

export async function updateCommissionStatus(
  commissionId: string,
  policyId: string,
  status: string,
) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase.from("commissions").update({ status }).eq("id", commissionId);
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
}
