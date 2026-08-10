"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";

export type ClaimFormState = { error: string } | undefined;

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

export async function createClaim(
  _prevState: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const policyId = str(formData, "policy_id");
  const dateOfLoss = str(formData, "date_of_loss");

  if (!policyId || !dateOfLoss) {
    return { error: "Λείπει το συμβόλαιο ή η ημερομηνία ζημιάς." };
  }

  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      policy_id: policyId,
      claim_number: str(formData, "claim_number"),
      date_of_loss: dateOfLoss,
      date_reported: str(formData, "date_reported") ?? new Date().toISOString().slice(0, 10),
      description: str(formData, "description"),
      claim_amount_estimated: num(formData, "claim_amount_estimated"),
      assigned_agent_id: agencyUser.id,
      created_by: agencyUser.id,
    })
    .select("id")
    .single();

  if (error || !claim) {
    return { error: "Σφάλμα κατά τη δημιουργία ζημιάς: " + (error?.message ?? "") };
  }

  revalidatePath("/dashboard/claims");
  revalidatePath(`/dashboard/policies/${policyId}`);
  redirect(`/dashboard/claims/${claim.id}?toast=${encodeURIComponent("Η ζημιά καταχωρήθηκε.")}`);
}

export async function updateClaimStatus(claimId: string, policyId: string, status: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase.from("claims").update({ status }).eq("id", claimId);
  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "claim_status_changed",
    description: `Η κατάσταση μιας ζημιάς άλλαξε σε "${status}".`,
    actorId: agencyUser.id,
  });
  revalidatePath(`/dashboard/claims/${claimId}`);
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/claims");
}

export async function bulkUpdateClaimStatus(claimIds: string[], status: string) {
  const agencyUser = await requireAgencyUser();
  if (claimIds.length === 0) return;
  const supabase = await createSupabaseClient();

  const { data: claims } = await supabase.from("claims").select("id, policy_id").in("id", claimIds);

  await supabase.from("claims").update({ status }).in("id", claimIds);

  await Promise.all(
    (claims ?? []).map((claim) =>
      logActivity(supabase, {
        entityType: "policy",
        entityId: claim.policy_id,
        action: "claim_status_changed",
        description: `Η κατάσταση μιας ζημιάς άλλαξε σε "${status}" (μαζική ενέργεια).`,
        actorId: agencyUser.id,
      }),
    ),
  );

  revalidatePath("/dashboard/claims");
  for (const claim of claims ?? []) {
    revalidatePath(`/dashboard/policies/${claim.policy_id}`);
  }
}

export async function updateClaimDetails(claimId: string, policyId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("claims")
    .update({
      claim_number: str(formData, "claim_number"),
      description: str(formData, "description"),
      claim_amount_estimated: num(formData, "claim_amount_estimated"),
      claim_amount_paid: num(formData, "claim_amount_paid"),
      adjuster_name: str(formData, "adjuster_name"),
      adjuster_contact: str(formData, "adjuster_contact"),
    })
    .eq("id", claimId);

  revalidatePath(`/dashboard/claims/${claimId}`);
  revalidatePath(`/dashboard/policies/${policyId}`);
}
