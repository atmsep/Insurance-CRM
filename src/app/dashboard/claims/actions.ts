"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity, logActivityBatch } from "@/lib/activity-log";
import { CACHE_TAGS } from "@/lib/cache-tags";

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
      file_number: str(formData, "file_number"),
      date_of_loss: dateOfLoss,
      date_reported: str(formData, "date_reported") ?? new Date().toISOString().slice(0, 10),
      description: str(formData, "description"),
      injured_party_name: str(formData, "injured_party_name"),
      claim_amount_estimated: num(formData, "claim_amount_estimated"),
      claim_category_id: str(formData, "claim_category_id"),
      assigned_agent_id: agencyUser.id,
      created_by: agencyUser.id,
    })
    .select("id")
    .single();

  if (error || !claim) {
    return { error: "Σφάλμα κατά τη δημιουργία ζημιάς: " + (error?.message ?? "") };
  }

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "claim_created",
    description: "Καταχωρήθηκε νέα ζημιά.",
    actorId: agencyUser.id,
  });

  revalidatePath("/dashboard/claims");
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
  redirect(`/dashboard/claims/${claim.id}?toast=${encodeURIComponent("Η ζημιά καταχωρήθηκε.")}`);
}

export async function updateClaimStatus(claimId: string, policyId: string, status: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("claims").update({ status }).eq("id", claimId);
  if (error) return;
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
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
}

export async function bulkUpdateClaimStatus(
  claimIds: string[],
  status: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (claimIds.length === 0) return;
  const supabase = await createSupabaseClient();

  const { data: claims } = await supabase.from("claims").select("id, policy_id").in("id", claimIds);

  const { error } = await supabase.from("claims").update({ status }).in("id", claimIds);
  if (error) {
    return { error: "Σφάλμα κατά τη μαζική ενημέρωση: " + error.message };
  }

  await logActivityBatch(
    supabase,
    (claims ?? []).map((claim) => ({
      entityType: "policy",
      entityId: claim.policy_id,
      action: "claim_status_changed",
      description: `Η κατάσταση μιας ζημιάς άλλαξε σε "${status}" (μαζική ενέργεια).`,
      actorId: agencyUser.id,
    })),
  );

  revalidatePath("/dashboard/claims");
  for (const claim of claims ?? []) {
    revalidatePath(`/dashboard/policies/${claim.policy_id}`);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
}

// Διαγραφή λάθος καταχωρημένης ζημιάς — admin/owner only. Refused while
// έγγραφα are still attached (they'd orphan in storage) or while a paid
// amount is recorded (real money shouldn't vanish silently) — clear those
// first, deliberately.
export async function deleteClaim(
  claimId: string,
  policyId: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Μόνο διαχειριστής μπορεί να διαγράψει ζημιά." };
  }
  const supabase = await createSupabaseClient();

  const { data: claim } = await supabase
    .from("claims")
    .select("claim_amount_paid")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { error: "Δεν βρέθηκε η ζημιά." };
  if ((claim.claim_amount_paid ?? 0) > 0) {
    return { error: "Η ζημιά έχει καταχωρημένη αποζημίωση — δεν διαγράφεται." };
  }

  const { count: docCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", claimId);
  if ((docCount ?? 0) > 0) {
    return { error: "Διάγραψε πρώτα τα έγγραφα της ζημιάς." };
  }

  await supabase.from("tasks").delete().eq("claim_id", claimId);
  const { error } = await supabase.from("claims").delete().eq("id", claimId);
  if (error) return { error: "Σφάλμα κατά τη διαγραφή: " + error.message };

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "claim_deleted",
    description: "Διαγράφηκε μια ζημιά.",
    actorId: agencyUser.id,
  });

  revalidatePath("/dashboard/claims");
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
  redirect(`/dashboard/claims?toast=${encodeURIComponent("Η ζημιά διαγράφηκε.")}`);
}

export async function updateClaimDetails(claimId: string, policyId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { error: updateError } = await supabase
    .from("claims")
    .update({
      claim_number: str(formData, "claim_number"),
      file_number: str(formData, "file_number"),
      description: str(formData, "description"),
      injured_party_name: str(formData, "injured_party_name"),
      claim_amount_estimated: num(formData, "claim_amount_estimated"),
      claim_amount_paid: num(formData, "claim_amount_paid"),
      claim_category_id: str(formData, "claim_category_id"),
      payment_date: str(formData, "payment_date"),
      closed_date: str(formData, "closed_date"),
      adjuster_name: str(formData, "adjuster_name"),
      adjuster_contact: str(formData, "adjuster_contact"),
    })
    .eq("id", claimId);
  if (updateError) return;

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "claim_updated",
    description: "Ενημερώθηκαν τα στοιχεία μιας ζημιάς.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/claims/${claimId}`);
  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  updateTag(CACHE_TAGS.reports);
}
