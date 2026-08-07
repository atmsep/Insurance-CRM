"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

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
  redirect(`/dashboard/claims/${claim.id}`);
}

export async function updateClaimStatus(claimId: string, policyId: string, status: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase.from("claims").update({ status }).eq("id", claimId);
  revalidatePath(`/dashboard/claims/${claimId}`);
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/claims");
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
