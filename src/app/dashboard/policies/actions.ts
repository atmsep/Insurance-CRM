"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { PaymentFrequency } from "@/lib/database.types";

export type PolicyFormState = { error: string } | undefined;

export async function searchPolicies(query: string): Promise<{ id: string; label: string }[]> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  if (!query.trim()) return [];

  // PostgREST can't OR a base-table column against an embedded-table column
  // in one filter tree, so this runs two queries (by policy number, by
  // client name) and merges/dedupes the results.
  const [byNumber, byClient] = await Promise.all([
    supabase
      .from("policies")
      .select("id, policy_number, clients(display_name)")
      .ilike("policy_number", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("policies")
      .select("id, policy_number, clients!inner(display_name)")
      .ilike("clients.display_name", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const merged = new Map<string, { id: string; label: string }>();
  for (const p of [...(byNumber.data ?? []), ...(byClient.data ?? [])]) {
    const client = p.clients as unknown as { display_name: string | null } | null;
    merged.set(p.id, { id: p.id, label: `${p.policy_number} — ${client?.display_name ?? "—"}` });
  }

  return [...merged.values()].slice(0, 20);
}

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

  const renewFromPolicyId = str(formData, "renew_from_policy_id");
  const policyGroupId = str(formData, "policy_group_id");

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
      premium_net: num(formData, "premium_net"),
      taxes_fees: num(formData, "taxes_fees"),
      payment_frequency: (str(formData, "payment_frequency") ?? "annual") as PaymentFrequency,
      status: "active",
      created_by: agencyUser.id,
      ...(renewFromPolicyId
        ? { previous_policy_id: renewFromPolicyId, policy_group_id: policyGroupId, is_renewal: true }
        : {}),
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
  redirect(`/dashboard/policies/${policy.id}?toast=${encodeURIComponent("Το συμβόλαιο δημιουργήθηκε.")}`);
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

export async function updatePolicyDetails(
  policyId: string,
  hasVehicle: boolean,
  hasProperty: boolean,
  hasLifeHealth: boolean,
  formData: FormData,
) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("policies")
    .update({
      start_date: str(formData, "start_date") ?? undefined,
      end_date: str(formData, "end_date") ?? undefined,
      premium_gross: num(formData, "premium_gross") ?? undefined,
      premium_net: num(formData, "premium_net"),
      taxes_fees: num(formData, "taxes_fees"),
      payment_frequency: str(formData, "payment_frequency") ?? undefined,
    })
    .eq("id", policyId);

  if (hasVehicle) {
    await supabase
      .from("policy_vehicle_details")
      .update({
        plate_number: str(formData, "plate_number"),
        make: str(formData, "make"),
        model: str(formData, "model"),
        manufacture_year: num(formData, "manufacture_year"),
      })
      .eq("policy_id", policyId);
  }

  if (hasProperty) {
    await supabase
      .from("policy_property_details")
      .update({
        address_street: str(formData, "address_street"),
        address_city: str(formData, "address_city"),
        square_meters: num(formData, "square_meters"),
        commercial_value: num(formData, "commercial_value"),
      })
      .eq("policy_id", policyId);
  }

  if (hasLifeHealth) {
    await supabase
      .from("policy_life_health_details")
      .update({
        coverage_type: str(formData, "coverage_type"),
        sum_insured: num(formData, "sum_insured"),
      })
      .eq("policy_id", policyId);
  }

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
