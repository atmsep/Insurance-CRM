"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser, getCurrentAgencyUser } from "@/lib/dal";
import { sendEmail } from "@/lib/email";
import { logActivity, logActivityBatch } from "@/lib/activity-log";
import type { PaymentFrequency } from "@/lib/database.types";
import { POLICY_STATUS_LABELS } from "./policy-labels";
import { createMovementForPolicy } from "./movements-actions";

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

export async function getPolicyClaims(policyId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  const { data: claims } = await supabase
    .from("claims")
    .select("id, claim_number, file_number, injured_party_name, status, date_of_loss, claim_amount_estimated")
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

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

// Shared by createPolicy's insert and updatePolicyDetails' update so the
// field list only lives in one place.
function vehicleDetailsPayload(formData: FormData) {
  return {
    plate_number: str(formData, "plate_number"),
    make: str(formData, "make"),
    model: str(formData, "model"),
    manufacturer: str(formData, "manufacturer"),
    manufacture_year: num(formData, "manufacture_year"),
    manufacture_month: num(formData, "manufacture_month"),
    color: str(formData, "color"),
    body_type: str(formData, "body_type"),
    vin_chassis_number: str(formData, "vin_chassis_number"),
    engine_number: str(formData, "engine_number"),
    engine_cc: num(formData, "engine_cc"),
    horsepower: num(formData, "horsepower"),
    seats: num(formData, "seats"),
    gross_weight_kg: num(formData, "gross_weight_kg"),
    tonnage: num(formData, "tonnage"),
    has_trailer: bool(formData, "has_trailer"),
    usage_type: str(formData, "usage_type"),
    driver_gender: str(formData, "driver_gender"),
    capacity_role: str(formData, "capacity_role"),
    zone_code: str(formData, "zone_code"),
    insurance_package: str(formData, "insurance_package"),
    protection_measures: str(formData, "protection_measures"),
    kteo_expiry_date: str(formData, "kteo_expiry_date"),
    insured_value: num(formData, "insured_value"),
    discount_percent: num(formData, "discount_percent"),
    special_discount_percent: num(formData, "special_discount_percent"),
    surcharge_percent: num(formData, "surcharge_percent"),
    required_license_type: str(formData, "required_license_type"),
    is_financed: bool(formData, "is_financed"),
    title_retained: bool(formData, "title_retained"),
    financing_bank: str(formData, "financing_bank"),
  };
}

// Permanent-policy model (Profia rebuild, see the plan): a policy created
// or renewed from here on lives as ONE policies row for its whole life —
// a renewal UPDATEs that same row instead of inserting a new one, and
// records the event as a policy_movements row instead. Renewal chains that
// already existed before this shipped (previous_policy_id/policy_group_id,
// multiple policies rows) are left completely alone and keep behaving
// exactly as they always have — EXCEPT the one renewal that happens to be
// their first one after this change ships, which "locks" the chain: it
// backfills one movement capturing the row's current (about-to-be-
// overwritten) state, re-parents its existing installments onto that
// movement, and from then on the row is permanent too. See
// getPolicyMovements for how the still-untouched older ancestors keep
// showing up as read-only synthetic history either way.
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

  const assignedAgentId = str(formData, "assigned_agent_id") ?? agencyUser.id;
  const brokerOfficeId = str(formData, "broker_office_id");
  const premiumNet = num(formData, "premium_net");
  const premiumGross = num(formData, "premium_gross") ?? 0;
  const paymentFrequency = (str(formData, "payment_frequency") ?? "annual") as PaymentFrequency;
  const startDate = str(formData, "start_date") ?? "";
  const endDate = str(formData, "end_date") ?? "";
  const policyNumber = str(formData, "policy_number") ?? "";

  let policyId: string;
  let renewalNumber = 1;

  if (renewFromPolicyId) {
    const { data: source } = await supabase
      .from("policies")
      .select(
        "id, policy_number, renewal_number, status, status_auto_managed, start_date, end_date, premium_net, premium_gross, assigned_agent_id, created_by",
      )
      .eq("id", renewFromPolicyId)
      .single();
    if (!source) return { error: "Δεν βρέθηκε το συμβόλαιο προς ανανέωση." };

    renewalNumber = source.renewal_number + 1;
    policyId = source.id;

    const { count: existingMovements } = await supabase
      .from("policy_movements")
      .select("id", { count: "exact", head: true })
      .eq("policy_id", source.id);

    if (!existingMovements) {
      // Legacy chain, first renewal since this feature shipped — backfill
      // just the LEDGER ENTRY for the row's current (soon to be
      // overwritten) state, and re-parent its already-existing
      // installments onto it. Deliberately does NOT fabricate new
      // commission rows here — real historical commissions for this
      // policy_id already exist from whenever this term was originally
      // issued/renewed (unlinked to any movement, exactly as before this
      // feature), and duplicating them would double-count.
      const { data: backfillMovement } = await supabase
        .from("policy_movements")
        .insert({
          policy_id: source.id,
          kind: source.renewal_number > 1 ? "renewal" : "policy",
          document_number: `${source.policy_number}/${source.renewal_number}`,
          issue_date: source.start_date,
          start_date: source.start_date,
          end_date: source.end_date,
          premium_net: source.premium_net,
          premium_gross: source.premium_gross,
          outgoing_agent_id: source.assigned_agent_id,
          created_by: source.created_by ?? agencyUser.id,
        })
        .select("id")
        .single();

      if (backfillMovement) {
        await supabase
          .from("policy_installments")
          .update({ movement_id: backfillMovement.id })
          .eq("policy_id", source.id)
          .is("movement_id", null);
      }
    }

    const { error: updateError } = await supabase
      .from("policies")
      .update({
        policy_number: policyNumber,
        carrier_id: carrierId,
        insurance_line_id: insuranceLineId,
        assigned_agent_id: assignedAgentId,
        broker_office_id: brokerOfficeId,
        start_date: startDate,
        end_date: endDate,
        premium_gross: premiumGross,
        premium_net: premiumNet,
        taxes_fees: num(formData, "taxes_fees"),
        payment_frequency: paymentFrequency,
        renewal_number: renewalNumber,
        is_renewal: true,
        status: "active",
        status_auto_managed: true,
      })
      .eq("id", policyId);
    if (updateError) {
      return { error: "Σφάλμα κατά την ανανέωση συμβολαίου: " + updateError.message };
    }
  } else {
    const { data: policy, error: policyError } = await supabase
      .from("policies")
      .insert({
        policy_number: policyNumber,
        client_id: clientId,
        carrier_id: carrierId,
        insurance_line_id: insuranceLineId,
        assigned_agent_id: assignedAgentId,
        broker_office_id: brokerOfficeId,
        start_date: startDate,
        end_date: endDate,
        premium_gross: premiumGross,
        premium_net: premiumNet,
        taxes_fees: num(formData, "taxes_fees"),
        payment_frequency: paymentFrequency,
        status: "active",
        created_by: agencyUser.id,
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
    policyId = policy.id;
  }

  let branchError: string | null = null;

  if (line.requires_vehicle_details) {
    const payload = vehicleDetailsPayload(formData);
    const { error } = renewFromPolicyId
      ? await supabase.from("policy_vehicle_details").update(payload).eq("policy_id", policyId)
      : await supabase.from("policy_vehicle_details").insert({ policy_id: policyId, ...payload });
    branchError = error?.message ?? null;
  } else if (line.requires_property_details) {
    const payload = {
      address_street: str(formData, "address_street"),
      address_city: str(formData, "address_city"),
      square_meters: num(formData, "square_meters"),
      commercial_value: num(formData, "commercial_value"),
    };
    const { error } = renewFromPolicyId
      ? await supabase.from("policy_property_details").update(payload).eq("policy_id", policyId)
      : await supabase.from("policy_property_details").insert({ policy_id: policyId, ...payload });
    branchError = error?.message ?? null;
  } else if (line.requires_life_health_details) {
    const payload = {
      coverage_type: str(formData, "coverage_type"),
      sum_insured: num(formData, "sum_insured"),
    };
    const { error } = renewFromPolicyId
      ? await supabase.from("policy_life_health_details").update(payload).eq("policy_id", policyId)
      : await supabase.from("policy_life_health_details").insert({ policy_id: policyId, ...payload });
    branchError = error?.message ?? null;
  }

  if (branchError) {
    if (!renewFromPolicyId) await supabase.from("policies").delete().eq("id", policyId);
    return { error: "Σφάλμα κατά την αποθήκευση στοιχείων κλάδου: " + branchError };
  }

  await createMovementForPolicy(supabase, {
    policyId,
    kind: renewFromPolicyId ? "renewal" : "policy",
    startDate,
    endDate,
    premiumNet,
    premiumGross,
    documentNumber: policyNumber,
    carrierId,
    insuranceLineId,
    brokerOfficeId,
    assignedAgentId,
    createdBy: agencyUser.id,
  });

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: renewFromPolicyId ? "renewed" : "created",
    description: renewFromPolicyId
      ? `Ανανεώθηκε το συμβόλαιο (περίοδος #${renewalNumber}).`
      : "Δημιουργήθηκε το συμβόλαιο.",
    actorId: agencyUser.id,
  });

  revalidatePath("/dashboard/policies");
  revalidatePath(`/dashboard/policies/${policyId}`);
  redirect(`/dashboard/policies/${policyId}?toast=${encodeURIComponent("Το συμβόλαιο δημιουργήθηκε.")}`);
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
      .update(vehicleDetailsPayload(formData))
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
