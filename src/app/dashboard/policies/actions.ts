"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { PaymentFrequency } from "@/lib/database.types";

export type PolicyFormState = { error: string } | undefined;

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

export async function createPolicy(
  _prevState: PolicyFormState,
  formData: FormData,
): Promise<PolicyFormState> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const insuranceLineId = str(formData, "insurance_line_id");
  const clientId = str(formData, "client_id");
  const carrierId = str(formData, "carrier_id");

  if (!insuranceLineId || !clientId || !carrierId) {
    return { error: "Επίλεξε πελάτη, ασφαλιστική εταιρεία και κλάδο." };
  }

  const { data: line } = await supabase
    .from("insurance_lines")
    .select("*")
    .eq("id", insuranceLineId)
    .single();

  if (!line) return { error: "Άγνωστος κλάδος ασφάλισης." };

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({
      policy_number: str(formData, "policy_number") ?? "",
      client_id: clientId,
      carrier_id: carrierId,
      insurance_line_id: insuranceLineId,
      assigned_agent_id: agencyUser.id,
      start_date: str(formData, "start_date") ?? "",
      end_date: str(formData, "end_date") ?? "",
      premium_gross: num(formData, "premium_gross") ?? 0,
      payment_frequency: (str(formData, "payment_frequency") ?? "annual") as PaymentFrequency,
      status: "active",
      created_by: agencyUser.id,
    })
    .select("id")
    .single();

  if (policyError || !policy) {
    return { error: "Σφάλμα κατά τη δημιουργία συμβολαίου: " + (policyError?.message ?? "") };
  }

  let branchError: string | null = null;

  if (line.requires_vehicle_details) {
    const { error } = await supabase.from("policy_vehicle_details").insert({
      policy_id: policy.id,
      plate_number: str(formData, "plate_number"),
      make: str(formData, "make"),
      model: str(formData, "model"),
      manufacture_year: num(formData, "manufacture_year"),
    });
    branchError = error?.message ?? null;
  } else if (line.requires_property_details) {
    const { error } = await supabase.from("policy_property_details").insert({
      policy_id: policy.id,
      address_street: str(formData, "address_street"),
      address_city: str(formData, "address_city"),
      square_meters: num(formData, "square_meters"),
      commercial_value: num(formData, "commercial_value"),
    });
    branchError = error?.message ?? null;
  } else if (line.requires_life_health_details) {
    const { error } = await supabase.from("policy_life_health_details").insert({
      policy_id: policy.id,
      coverage_type: str(formData, "coverage_type"),
      sum_insured: num(formData, "sum_insured"),
    });
    branchError = error?.message ?? null;
  }

  if (branchError) {
    await supabase.from("policies").delete().eq("id", policy.id);
    return { error: "Σφάλμα κατά την αποθήκευση στοιχείων κλάδου: " + branchError };
  }

  revalidatePath("/dashboard/policies");
  redirect(`/dashboard/policies/${policy.id}`);
}

export async function updatePolicyStatus(policyId: string, status: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase.from("policies").update({ status }).eq("id", policyId);
  revalidatePath(`/dashboard/policies/${policyId}`);
}

export async function createInstallment(policyId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { count } = await supabase
    .from("policy_installments")
    .select("id", { count: "exact", head: true })
    .eq("policy_id", policyId);

  await supabase.from("policy_installments").insert({
    policy_id: policyId,
    installment_number: (count ?? 0) + 1,
    due_date: str(formData, "due_date") ?? "",
    amount: num(formData, "amount") ?? 0,
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
}

export async function markInstallmentPaid(policyId: string, installmentId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase
    .from("policy_installments")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", installmentId);
  revalidatePath(`/dashboard/policies/${policyId}`);
}
