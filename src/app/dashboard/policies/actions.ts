"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser, getCurrentAgencyUser } from "@/lib/dal";
import { sendEmail } from "@/lib/email";
import { logActivity, logActivityBatch } from "@/lib/activity-log";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { PaymentFrequency } from "@/lib/database.types";
import { installmentRemaining } from "./balance";
import { POLICY_STATUS_LABELS } from "./policy-labels";

export type PolicyFormState = { error: string; field?: string } | undefined;
export type SendEmailState = { error: string } | { success: string } | undefined;

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

type SingleOrMany<T> = T | T[] | null;

export type InstallmentPayment = {
  id: string;
  amount: number;
  paid_at: string;
  receipt_number: string | null;
  is_reversed: boolean;
  reversal_reason: string | null;
  payment_methods: SingleOrMany<{ name: string }>;
  agency_users: SingleOrMany<{ full_name: string }>;
};

export type InstallmentWithPayments = {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
  installment_payments: InstallmentPayment[];
};

export async function getPolicyInstallments(policyId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const [{ data: installments }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("policy_installments")
      .select(
        "*, installment_payments(*, payment_methods(name), " +
          "agency_users!installment_payments_paid_by_fkey(full_name))",
      )
      .eq("policy_id", policyId)
      .order("installment_number", { ascending: true }),
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  return {
    installments: (installments ?? []) as unknown as InstallmentWithPayments[],
    paymentMethods: paymentMethods ?? [],
  };
}

export async function getPolicyClaims(policyId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const { data: claims } = await supabase
    .from("claims")
    .select("id, claim_number, status, date_of_loss, claim_amount_estimated")
    .eq("policy_id", policyId)
    .order("date_of_loss", { ascending: false });
  return claims ?? [];
}

export async function getClientAssignedAgent(clientId: string): Promise<string | null> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const { data } = await supabase
    .from("clients")
    .select("assigned_agent_id")
    .eq("id", clientId)
    .single();
  return data?.assigned_agent_id ?? null;
}

// Looks up the agreed commission % for a broker/carrier/line combination, as
// of today — non-blocking: returns null (no prefill, plain manual entry)
// when no agreement is configured rather than erroring.
export async function getCommissionRate(
  brokerOfficeId: string,
  carrierId: string,
  insuranceLineId: string,
): Promise<number | null> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("carrier_commission_rates")
    .select("default_commission_percent")
    .eq("broker_office_id", brokerOfficeId)
    .eq("carrier_id", carrierId)
    .eq("insurance_line_id", insuranceLineId)
    .eq("is_active", true)
    .lte("valid_from", today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.default_commission_percent ?? null;
}

// Same lookup as getCommissionRate, but for what we pay OUT to a
// συνεργάτης (commission_payees) instead of what comes in from a broker
// office — mirrors the outgoing agreement structure added alongside the
// incoming one (see commission-agreements-tab.tsx).
export async function getPayeeCommissionRate(
  payeeId: string,
  carrierId: string,
  insuranceLineId: string,
): Promise<number | null> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("carrier_commission_rates")
    .select("default_commission_percent")
    .eq("payee_id", payeeId)
    .eq("carrier_id", carrierId)
    .eq("insurance_line_id", insuranceLineId)
    .eq("is_active", true)
    .lte("valid_from", today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.default_commission_percent ?? null;
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

// Every policy — whatever its payment_frequency or duration — is billed as
// exactly ONE installment for the full gross premium, due on start_date.
// payment_frequency is informational only; it does not split the billing.
function buildInstallmentRows(policyId: string, startDate: string, premiumGross: number) {
  return [
    {
      policy_id: policyId,
      installment_number: 1,
      due_date: startDate,
      amount: premiumGross,
    },
  ];
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

  let renewalNumber = 1;
  let previousTerm: { renewal_number: number; status: string; status_auto_managed: boolean } | null = null;
  if (renewFromPolicyId) {
    const { data } = await supabase
      .from("policies")
      .select("renewal_number, status, status_auto_managed")
      .eq("id", renewFromPolicyId)
      .single();
    previousTerm = data;
    renewalNumber = (previousTerm?.renewal_number ?? 1) + 1;
  }

  const assignedAgentId = str(formData, "assigned_agent_id") ?? agencyUser.id;
  const brokerOfficeId = str(formData, "broker_office_id");
  const premiumNet = num(formData, "premium_net");
  const premiumGross = num(formData, "premium_gross") ?? 0;
  const paymentFrequency = (str(formData, "payment_frequency") ?? "annual") as PaymentFrequency;
  const startDate = str(formData, "start_date") ?? "";

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({
      policy_number: str(formData, "policy_number") ?? "",
      client_id: clientId,
      carrier_id: carrierId,
      insurance_line_id: insuranceLineId,
      assigned_agent_id: assignedAgentId,
      broker_office_id: brokerOfficeId,
      start_date: startDate,
      end_date: str(formData, "end_date") ?? "",
      premium_gross: premiumGross,
      premium_net: premiumNet,
      taxes_fees: num(formData, "taxes_fees"),
      payment_frequency: paymentFrequency,
      status: "active",
      created_by: agencyUser.id,
      ...(renewFromPolicyId
        ? {
            previous_policy_id: renewFromPolicyId,
            policy_group_id: policyGroupId,
            is_renewal: true,
            renewal_number: renewalNumber,
          }
        : {}),
    })
    .select("id")
    .single();

  if (policyError?.code === "23505") {
    return {
      error: "Υπάρχει ήδη συμβόλαιο με αυτόν τον αριθμό, την ίδια εταιρεία και ημερομηνία έναρξης.",
      field: "policy_number",
    };
  }
  if (policyError || !policy) {
    return { error: "Σφάλμα κατά τη δημιουργία συμβολαίου: " + (policyError?.message ?? "") };
  }

  // The new term is now the current one — the term it renewed no longer is,
  // so it drops out of policy lists (which filter on is_current_term) while
  // remaining reachable through the renewal history on the policy detail
  // page. Also expire the old term's status immediately (rather than
  // leaving it stale until tonight's automatic recompute) — but only if
  // it's still auto-managed and not already in a terminal manual state, so
  // a manually-set 'cancelled'/'lapsed' term is never silently overwritten.
  if (renewFromPolicyId) {
    const shouldExpireOldTerm =
      previousTerm?.status_auto_managed !== false &&
      previousTerm?.status !== "cancelled" &&
      previousTerm?.status !== "lapsed";

    await supabase
      .from("policies")
      .update({
        is_current_term: false,
        ...(shouldExpireOldTerm ? { status: "expired" } : {}),
      })
      .eq("id", renewFromPolicyId);
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

  // Auto-generate the single receivable for the full gross premium, so the
  // agent only ever has to click "Είσπραξη" when money actually comes in
  // instead of first entering it by hand. Applies to renewals too — a
  // renewed term needs its own fresh receivable just like new business.
  await supabase
    .from("policy_installments")
    .insert(buildInstallmentRows(policy.id, startDate, premiumGross));

  // Auto-record the incoming commission owed by the carrier, using whatever
  // rate is agreed for this broker/carrier/line combination — skipped
  // (not zeroed) when there's no broker office or no matching agreement,
  // since commissions have no amount-edit UI today; the admin can still add
  // one manually via "Προσθήκη προμήθειας" for those cases. Renewals are
  // tagged "renewal" instead of "new_business" so the commissions list
  // reflects the actual nature of the sale.
  if (brokerOfficeId) {
    const ratePercent = await getCommissionRate(brokerOfficeId, carrierId, insuranceLineId);
    if (ratePercent != null) {
      const baseAmount = premiumNet ?? 0;
      const commissionAmount = Math.round(((baseAmount * ratePercent) / 100) * 100) / 100;
      await supabase.from("commissions").insert({
        policy_id: policy.id,
        agent_id: assignedAgentId,
        carrier_id: carrierId,
        commission_type: renewFromPolicyId ? "renewal" : "new_business",
        direction: "incoming",
        base_amount: baseAmount,
        commission_rate_percent: ratePercent,
        commission_amount: commissionAmount,
        period: startDate || null,
      });
    }
  }

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policy.id,
    action: renewFromPolicyId ? "renewed" : "created",
    description: renewFromPolicyId
      ? `Ανανεώθηκε το συμβόλαιο (περίοδος #${renewalNumber}).`
      : "Δημιουργήθηκε το συμβόλαιο.",
    actorId: agencyUser.id,
  });

  revalidatePath("/dashboard/policies");
  if (renewFromPolicyId) revalidatePath(`/dashboard/policies/${renewFromPolicyId}`);
  redirect(`/dashboard/policies/${policy.id}?toast=${encodeURIComponent("Το συμβόλαιο δημιουργήθηκε.")}`);
}

export async function updatePolicyStatus(policyId: string, status: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();
  // A manual status choice sticks "μέχρι νεωτέρας" — the daily automatic
  // recompute only ever touches status_auto_managed = true rows.
  await supabase.from("policies").update({ status, status_auto_managed: false }).eq("id", policyId);
  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "status_changed",
    description: `Η κατάσταση άλλαξε σε "${status}".`,
    actorId: agencyUser.id,
  });
  revalidatePath(`/dashboard/policies/${policyId}`);
}

export async function bulkUpdatePolicyStatus(
  policyIds: string[],
  status: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (policyIds.length === 0) return;
  const supabase = await createSupabaseClient();

  const { error } = await supabase
    .from("policies")
    .update({ status, status_auto_managed: false })
    .in("id", policyIds);
  if (error) {
    return { error: "Σφάλμα κατά τη μαζική ενημέρωση: " + error.message };
  }

  await logActivityBatch(
    supabase,
    policyIds.map((policyId) => ({
      entityType: "policy",
      entityId: policyId,
      action: "status_changed",
      description: `Η κατάσταση άλλαξε σε "${status}" (μαζική ενέργεια).`,
      actorId: agencyUser.id,
    })),
  );
  revalidatePath("/dashboard/policies");
}

// Undoes a manual pin (see updatePolicyStatus/bulkUpdatePolicyStatus) and
// recomputes the status immediately from current data, instead of waiting
// for tonight's automatic recompute. The RPC runs as the calling user (not
// security definer), so it's still bound by the same policies_update RLS
// policy that already protects the plain status dropdown.
export async function resetPolicyStatusToAuto(
  policyId: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { data: newStatus, error } = await supabase.rpc("reset_policy_status_to_auto", {
    p_policy_id: policyId,
  });
  if (error) {
    return { error: "Σφάλμα κατά την επαναφορά σε αυτόματη διαχείριση: " + error.message };
  }

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "status_changed",
    description: `Η κατάσταση επανήλθε σε αυτόματη διαχείριση (${POLICY_STATUS_LABELS[newStatus as string] ?? newStatus}).`,
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
}

export async function createInstallment(policyId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
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

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "installment_created",
    description: "Προστέθηκε νέα είσπραξη.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
}

export async function updatePolicyDetails(
  policyId: string,
  hasVehicle: boolean,
  hasProperty: boolean,
  hasLifeHealth: boolean,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { error: policyError } = await supabase
    .from("policies")
    .update({
      start_date: str(formData, "start_date") ?? undefined,
      end_date: str(formData, "end_date") ?? undefined,
      premium_gross: num(formData, "premium_gross") ?? undefined,
      premium_net: num(formData, "premium_net"),
      taxes_fees: num(formData, "taxes_fees"),
      payment_frequency: str(formData, "payment_frequency") ?? undefined,
      assigned_agent_id: str(formData, "assigned_agent_id"),
      broker_office_id: str(formData, "broker_office_id"),
    })
    .eq("id", policyId);

  if (policyError) {
    return { error: "Σφάλμα κατά την αποθήκευση: " + policyError.message };
  }

  if (hasVehicle) {
    const { error } = await supabase
      .from("policy_vehicle_details")
      .update({
        plate_number: str(formData, "plate_number"),
        make: str(formData, "make"),
        model: str(formData, "model"),
        manufacture_year: num(formData, "manufacture_year"),
      })
      .eq("policy_id", policyId);
    if (error) return { error: "Σφάλμα κατά την αποθήκευση στοιχείων οχήματος: " + error.message };
  }

  if (hasProperty) {
    const { error } = await supabase
      .from("policy_property_details")
      .update({
        address_street: str(formData, "address_street"),
        address_city: str(formData, "address_city"),
        square_meters: num(formData, "square_meters"),
        commercial_value: num(formData, "commercial_value"),
      })
      .eq("policy_id", policyId);
    if (error) return { error: "Σφάλμα κατά την αποθήκευση στοιχείων ακινήτου: " + error.message };
  }

  if (hasLifeHealth) {
    const { error } = await supabase
      .from("policy_life_health_details")
      .update({
        coverage_type: str(formData, "coverage_type"),
        sum_insured: num(formData, "sum_insured"),
      })
      .eq("policy_id", policyId);
    if (error) return { error: "Σφάλμα κατά την αποθήκευση στοιχείων κάλυψης: " + error.message };
  }

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "updated",
    description: "Ενημερώθηκαν τα στοιχεία του συμβολαίου.",
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
}

// Records an actual collection as its own transaction row (installment_payments)
// rather than overwriting a single rolled-up total, so a partial payment
// followed by a top-up shows as two distinct movements everywhere instead
// of merging into one. A DB trigger recomputes the parent installment's
// paid_amount/status from the active (non-reversed) transactions afterward.
// Self-attributed from the server session, never trusted from the client —
// the RLS policy on installment_payments independently enforces the same.
export async function collectInstallmentPayment(
  policyId: string,
  installmentId: string,
  formData: FormData,
) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { data: installment } = await supabase
    .from("policy_installments")
    .select("amount, paid_amount, policies!inner(client_id)")
    .eq("id", installmentId)
    .single();
  if (!installment) return;

  const remainingDue = installmentRemaining(installment);
  const enteredRaw = formData.get("paid_amount");
  const entered = enteredRaw !== null && enteredRaw !== "" ? Number(enteredRaw) : NaN;
  const newPayment = Number.isFinite(entered) && entered > 0 ? entered : remainingDue;
  if (newPayment <= 0) return;

  const paymentMethodId = (formData.get("payment_method_id") as string) || null;
  const receiptNumber = (formData.get("receipt_number") as string) || null;

  const { error } = await supabase.from("installment_payments").insert({
    installment_id: installmentId,
    amount: Math.round(newPayment * 100) / 100,
    payment_method_id: paymentMethodId,
    receipt_number: receiptNumber,
    paid_by: agencyUser.id,
  });
  if (error) return;

  const tip = Math.max(Math.round((newPayment - remainingDue) * 100) / 100, 0);
  const tipNote = tip > 0 ? ` (εκ των οποίων ${tip.toFixed(2)} € tip)` : "";
  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "payment_collected",
    description: `Εισπράχθηκαν ${newPayment.toFixed(2)} €${tipNote}.`,
    actorId: agencyUser.id,
  });

  const collectClientId = (installment.policies as unknown as { client_id: string } | null)?.client_id;

  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/installments");
  revalidatePath("/dashboard/cash-register");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  if (collectClientId) revalidatePath(`/dashboard/clients/${collectClientId}`);
  updateTag(CACHE_TAGS.reports);
}

// Owner/admin only (enforced both here and by RLS). Reverses one specific
// transaction rather than the whole installment — never touches the
// original row, just flags it, so a disputed collection stays visible as
// evidence instead of being erased. The DB trigger then recomputes the
// parent installment's paid_amount/status from what's left active.
export async function reverseInstallmentPayment(
  policyId: string,
  paymentId: string,
  formData: FormData,
) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const reason = (formData.get("cancellation_reason") as string) || null;
  if (!reason) return { error: "Η αιτιολογία ακύρωσης είναι υποχρεωτική." };

  await supabase
    .from("installment_payments")
    .update({
      is_reversed: true,
      reversed_by: agencyUser.id,
      reversed_at: new Date().toISOString(),
      reversal_reason: reason,
    })
    .eq("id", paymentId);

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "payment_cancelled",
    description: `Ακυρώθηκε είσπραξη: ${reason}`,
    actorId: agencyUser.id,
  });

  const { data: reversedInstallmentPolicy } = await supabase
    .from("policies")
    .select("client_id")
    .eq("id", policyId)
    .single();

  revalidatePath(`/dashboard/policies/${policyId}`);
  revalidatePath("/dashboard/installments");
  revalidatePath("/dashboard/cash-register");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  if (reversedInstallmentPolicy?.client_id) {
    revalidatePath(`/dashboard/clients/${reversedInstallmentPolicy.client_id}`);
  }
  updateTag(CACHE_TAGS.reports);
}

export async function sendPolicyEmail(
  policyId: string,
  _prevState: SendEmailState,
  formData: FormData,
): Promise<SendEmailState> {
  await requireAgencyUser();

  const to = formData.get("to") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;

  if (!to || !subject || !body) {
    return { error: "Συμπλήρωσε θέμα και κείμενο." };
  }

  const result = await sendEmail({ to, subject, html: body });
  if (!result.ok) {
    return { error: "Σφάλμα αποστολής: " + result.error };
  }

  revalidatePath(`/dashboard/policies/${policyId}`);
  return { success: "Το email στάλθηκε." };
}

// Powers the policies list page's default "last 50 visited" view. Fired
// from a client-side useEffect (VisitTracker), never called directly from
// a server component render — Next.js runs server-component side effects
// on <Link> prefetch too, which would log a "visit" from a plain hover.
export async function recordPolicyVisit(policyId: string) {
  const agencyUser = await getCurrentAgencyUser();
  if (!agencyUser) return;
  const supabase = await createSupabaseClient();
  await supabase.from("policy_visits").upsert(
    { policy_id: policyId, agency_user_id: agencyUser.id, visited_at: new Date().toISOString() },
    { onConflict: "policy_id,agency_user_id" },
  );
}
