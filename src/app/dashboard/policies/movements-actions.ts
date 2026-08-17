"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { installmentRemaining, isBillablePolicyStatus } from "./balance";
import { POLICY_MOVEMENT_KIND_LABELS } from "./movement-labels";
import type { PolicyMovementKind } from "@/lib/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type MovementRow = {
  id: string;
  // Real policy_movements rows can be opened (Απόδειξη dialog); synthetic
  // rows reconstructed from a legacy renewal chain (see module doc below)
  // are history-only — this app never had per-term installments/commissions
  // to show for them individually, only the flat total the term's policy
  // row already carried.
  isReal: boolean;
  kind: PolicyMovementKind;
  kindLabel: string;
  documentNumber: string | null;
  agentName: string | null;
  startDate: string;
  endDate: string;
  premiumNet: number | null;
  premiumGross: number;
  outstanding: number;
  producedAt: string;
};

type LegacyTermRow = {
  id: string;
  policy_number: string;
  renewal_number: number;
  status: string;
  start_date: string;
  end_date: string;
  premium_net: number | null;
  premium_gross: number;
  previous_policy_id: string | null;
  created_at: string;
  agency_users: { full_name: string } | { full_name: string }[] | null;
};

// Legacy renewal chains (policy_group_id/previous_policy_id, pre-dating
// this feature) are never migrated into policy_movements — see the plan's
// "Παραμένουν αναλλοίωτα" section. Instead, each ancestor term is shown as
// a read-only synthetic movement, computed the same way the old (removed)
// movements tab derived "kind" from renewal_number/status. If the CURRENT
// policy row has no real movement yet either (either a never-renewed
// pre-feature policy, or a legacy chain that hasn't been renewed again
// since this shipped), its own current state is synthesized too — once it
// gets its first real movement (createPolicy backfills one on first
// renewal, see there), this stops including the current row itself.
// Synthesizes exactly ONE term row (no chain-walking) — the building block
// both getLegacyAncestorMovements (walks previous_policy_id) and
// getPolicyMovements (the current row alone, when it has no real movement
// of its own yet) are built from, so a term is never synthesized twice.
async function synthesizeTermMovement(
  supabase: SupabaseServerClient,
  termId: string,
): Promise<{ row: MovementRow; previousPolicyId: string | null } | null> {
  const termResult = await supabase
    .from("policies")
    .select(
      "id, policy_number, renewal_number, status, start_date, end_date, premium_net, premium_gross, previous_policy_id, created_at, agency_users!policies_assigned_agent_id_fkey(full_name)",
    )
    .eq("id", termId)
    .maybeSingle();
  const term = termResult.data as unknown as LegacyTermRow | null;
  if (!term) return null;

  const { data: installments } = await supabase
    .from("policy_installments")
    .select("amount, paid_amount")
    .eq("policy_id", term.id)
    .is("movement_id", null);

  const paid = (installments ?? []).reduce((sum, i) => sum + Math.min(i.paid_amount ?? 0, i.amount), 0);
  const totalAmount = (installments ?? []).reduce((sum, i) => sum + i.amount, 0);
  const outstanding = isBillablePolicyStatus(term.status)
    ? Math.max((totalAmount || term.premium_gross) - paid, 0)
    : 0;

  const kind: PolicyMovementKind =
    term.status === "cancelled" ? "cancellation" : term.renewal_number > 1 ? "renewal" : "policy";

  return {
    row: {
      id: term.id,
      isReal: false,
      kind,
      kindLabel: POLICY_MOVEMENT_KIND_LABELS[kind],
      documentNumber: `${term.policy_number}/${term.renewal_number}`,
      agentName: (term.agency_users as unknown as { full_name: string } | null)?.full_name ?? null,
      startDate: term.start_date,
      endDate: term.end_date,
      premiumNet: term.premium_net,
      premiumGross: term.premium_gross,
      outstanding,
      producedAt: term.created_at,
    },
    previousPolicyId: term.previous_policy_id,
  };
}

async function getLegacyAncestorMovements(
  supabase: SupabaseServerClient,
  policyId: string,
): Promise<MovementRow[]> {
  const rows: MovementRow[] = [];
  let cursor: string | null = policyId;
  const visited = new Set<string>();

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const result = await synthesizeTermMovement(supabase, cursor);
    if (!result) break;
    rows.push(result.row);
    cursor = result.previousPolicyId;
  }

  return rows;
}

export async function getPolicyMovements(policyId: string): Promise<MovementRow[]> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { data: policy } = await supabase
    .from("policies")
    .select("id, previous_policy_id, status")
    .eq("id", policyId)
    .single();
  if (!policy) return [];

  const { data: movements } = await supabase
    .from("policy_movements")
    .select(
      "id, kind, document_number, start_date, end_date, premium_net, premium_gross, created_at, outgoing_agent_id, agency_users!policy_movements_outgoing_agent_id_fkey(full_name)",
    )
    .eq("policy_id", policyId)
    .order("created_at", { ascending: true });

  const realMovements = movements ?? [];

  let installmentsByMovement = new Map<string, { amount: number; paid_amount: number | null }[]>();
  if (realMovements.length > 0) {
    const { data: installments } = await supabase
      .from("policy_installments")
      .select("movement_id, amount, paid_amount")
      .in(
        "movement_id",
        realMovements.map((m) => m.id),
      );
    installmentsByMovement = new Map();
    for (const i of installments ?? []) {
      if (!i.movement_id) continue;
      const list = installmentsByMovement.get(i.movement_id) ?? [];
      list.push(i);
      installmentsByMovement.set(i.movement_id, list);
    }
  }

  const realRows: MovementRow[] = realMovements.map((m) => {
    const insts = installmentsByMovement.get(m.id) ?? [];
    const paid = insts.reduce((sum, i) => sum + Math.min(i.paid_amount ?? 0, i.amount), 0);
    const total = insts.reduce((sum, i) => sum + i.amount, 0);
    return {
      id: m.id,
      isReal: true,
      kind: m.kind,
      kindLabel: POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind,
      documentNumber: m.document_number,
      agentName: (m.agency_users as unknown as { full_name: string } | null)?.full_name ?? null,
      startDate: m.start_date,
      endDate: m.end_date,
      premiumNet: m.premium_net,
      premiumGross: m.premium_gross,
      outstanding: Math.max((total || m.premium_gross) - paid, 0),
      producedAt: m.created_at,
    };
  });

  // Ancestors (previous_policy_id chain) are always synthetic. The current
  // row itself is only synthesized when it has no real movement of its own
  // yet — as soon as createPolicy backfills one on first renewal, the real
  // row takes over.
  const ancestorStart = policy.previous_policy_id;
  const ancestorRows = ancestorStart
    ? await getLegacyAncestorMovements(supabase, ancestorStart)
    : [];
  const currentTerm = realRows.length === 0 ? await synthesizeTermMovement(supabase, policyId) : null;
  const currentRow = currentTerm ? [currentTerm.row] : [];

  return [...ancestorRows.reverse(), ...currentRow, ...realRows].sort(
    (a, b) => new Date(a.producedAt).getTime() - new Date(b.producedAt).getTime(),
  );
}

export type MovementReceiptData = {
  movement: {
    id: string;
    kind: PolicyMovementKind;
    documentNumber: string | null;
    applicationNumber: string | null;
    issueDate: string;
    startDate: string;
    endDate: string;
    premiumNet: number | null;
    premiumGross: number;
    insurancePackage: string | null;
    description: string | null;
    notes: string | null;
    premiumRemittedAt: string | null;
    outgoingCommissionRemittedAt: string | null;
    outgoingAgentId: string | null;
    outgoingAgentName: string | null;
  };
  incoming: {
    id: string;
    referenceRatePercent: number | null;
    referenceAmount: number | null;
    rateePercent: number | null;
    amount: number;
    isManualOverride: boolean;
  } | null;
  outgoing: {
    id: string;
    ratePercent: number | null;
    amount: number;
    isManualOverride: boolean;
  } | null;
  installments: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    paidDate: string | null;
    amount: number;
    paidAmount: number | null;
    status: string;
  }[];
  paymentMethods: { id: string; name: string }[];
};

export async function getMovementReceipt(movementId: string): Promise<MovementReceiptData | null> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { data: movement } = await supabase
    .from("policy_movements")
    .select(
      "id, kind, document_number, application_number, issue_date, start_date, end_date, premium_net, premium_gross, insurance_package, description, notes, premium_remitted_at, outgoing_commission_remitted_at, outgoing_agent_id, agency_users!policy_movements_outgoing_agent_id_fkey(full_name)",
    )
    .eq("id", movementId)
    .maybeSingle();
  if (!movement) return null;

  const [{ data: installments }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("policy_installments")
      .select("id, installment_number, due_date, paid_date, amount, paid_amount, status")
      .eq("movement_id", movementId)
      .order("installment_number", { ascending: true }),
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  // Ακύρωση has no δόση to attach a commission to (nothing to collect —
  // it's a refund), so its clawback commission rows hang off
  // policy_movement_id directly instead (see migration 0087). Every other
  // kind always has at least one installment, so this only ever takes the
  // movement_id branch for cancellations.
  const installmentIds = (installments ?? []).map((i) => i.id);
  const commissionColumns =
    "id, direction, reference_rate_percent, reference_amount, commission_rate_percent, commission_amount, is_manual_override";
  const { data: commissions } = installmentIds.length
    ? await supabase.from("commissions").select(commissionColumns).in("policy_installment_id", installmentIds)
    : await supabase.from("commissions").select(commissionColumns).eq("policy_movement_id", movementId);

  const incomingRow = (commissions ?? []).find((c) => c.direction === "incoming") ?? null;
  const outgoingRow = (commissions ?? []).find((c) => c.direction === "outgoing") ?? null;

  return {
    movement: {
      id: movement.id,
      kind: movement.kind,
      documentNumber: movement.document_number,
      applicationNumber: movement.application_number,
      issueDate: movement.issue_date,
      startDate: movement.start_date,
      endDate: movement.end_date,
      premiumNet: movement.premium_net,
      premiumGross: movement.premium_gross,
      insurancePackage: movement.insurance_package,
      description: movement.description,
      notes: movement.notes,
      premiumRemittedAt: movement.premium_remitted_at,
      outgoingCommissionRemittedAt: movement.outgoing_commission_remitted_at,
      outgoingAgentId: movement.outgoing_agent_id,
      outgoingAgentName: (movement.agency_users as unknown as { full_name: string } | null)?.full_name ?? null,
    },
    incoming: incomingRow
      ? {
          id: incomingRow.id,
          referenceRatePercent: incomingRow.reference_rate_percent,
          referenceAmount: incomingRow.reference_amount,
          rateePercent: incomingRow.commission_rate_percent,
          amount: incomingRow.commission_amount,
          isManualOverride: incomingRow.is_manual_override,
        }
      : null,
    outgoing: outgoingRow
      ? {
          id: outgoingRow.id,
          ratePercent: outgoingRow.commission_rate_percent,
          amount: outgoingRow.commission_amount,
          isManualOverride: outgoingRow.is_manual_override,
        }
      : null,
    installments: (installments ?? []).map((i) => ({
      id: i.id,
      installmentNumber: i.installment_number,
      dueDate: i.due_date,
      paidDate: i.paid_date,
      amount: i.amount,
      paidAmount: i.paid_amount,
      status: i.status,
    })),
    paymentMethods: paymentMethods ?? [],
  };
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(formData: FormData, key: string) {
  const v = str(formData, key);
  return v === null ? null : Number(v);
}

// A movement can carry more than one δόση (see createMovementForPolicy /
// the legacy-chain backfill in createPolicy) — commission always attaches
// to the FIRST one, consistent with how it's auto-created, regardless of
// how many δόσεις the movement ends up with.
async function getFirstInstallmentId(supabase: SupabaseServerClient, movementId: string): Promise<string | null> {
  const { data } = await supabase
    .from("policy_installments")
    .select("id")
    .eq("movement_id", movementId)
    .order("installment_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Χειροκίνητη εισερχόμενη προμήθεια — the "Ειδική εισερχόμενη προμήθεια"
// checkbox in Profia: overrides (or fills in, when no rate ever resolved)
// whatever createMovementForPolicy auto-calculated. Owner/admin only, same
// boundary as every other commission write in this schema.
export async function updateIncomingCommission(
  movementId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const amount = num(formData, "commission_amount");
  if (amount === null) return { error: "Συμπλήρωσε ποσό προμήθειας." };
  const ratePercent = num(formData, "commission_rate_percent");
  const isManualOverride = formData.get("is_manual_override") === "on";

  const { data: movement } = await supabase
    .from("policy_movements")
    .select("policy_id, kind, premium_net, policies(carrier_id, assigned_agent_id)")
    .eq("id", movementId)
    .single();
  if (!movement) return { error: "Δεν βρέθηκε η κίνηση." };

  // Ακύρωση has no δόση (nothing to collect — it's a refund), so it has
  // no first installment either; its commission is found/anchored via
  // policy_movement_id instead (see migration 0087).
  const installmentId = await getFirstInstallmentId(supabase, movementId);

  const { data: existing } = installmentId
    ? await supabase
        .from("commissions")
        .select("id")
        .eq("policy_installment_id", installmentId)
        .eq("direction", "incoming")
        .maybeSingle()
    : await supabase
        .from("commissions")
        .select("id")
        .eq("policy_movement_id", movementId)
        .eq("direction", "incoming")
        .maybeSingle();

  if (existing) {
    await supabase
      .from("commissions")
      .update({ commission_rate_percent: ratePercent, commission_amount: amount, is_manual_override: isManualOverride })
      .eq("id", existing.id);
  } else {
    const policy = movement.policies as unknown as { carrier_id: string; assigned_agent_id: string | null } | null;
    if (!policy) return { error: "Δεν βρέθηκαν στοιχεία συμβολαίου." };
    await supabase.from("commissions").insert({
      policy_id: movement.policy_id,
      agent_id: policy.assigned_agent_id ?? agencyUser.id,
      carrier_id: policy.carrier_id,
      policy_installment_id: installmentId,
      policy_movement_id: installmentId ? null : movementId,
      commission_type: movement.kind === "renewal" ? "renewal" : movement.kind === "cancellation" ? "cancellation" : "new_business",
      direction: "incoming",
      base_amount: movement.premium_net,
      commission_rate_percent: ratePercent,
      commission_amount: amount,
      is_manual_override: isManualOverride,
    });
  }

  revalidatePath(`/dashboard/policies/${movement.policy_id}`);
}

// Χειροκίνητη εξερχόμενη προμήθεια — same idea, for what the agency pays
// OUT to the movement's servicing agent (outgoing_agent_id). Needs that
// agent's mirrored commission_payees row to exist (see
// syncPayeeForAgencyUser) since commissions.payee_id is required for any
// outgoing row.
export async function updateOutgoingCommission(
  movementId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const amount = num(formData, "commission_amount");
  if (amount === null) return { error: "Συμπλήρωσε ποσό προμήθειας." };
  const ratePercent = num(formData, "commission_rate_percent");
  const isManualOverride = formData.get("is_manual_override") === "on";

  const { data: movement } = await supabase
    .from("policy_movements")
    .select("policy_id, kind, premium_net, outgoing_agent_id, policies(carrier_id)")
    .eq("id", movementId)
    .single();
  if (!movement) return { error: "Δεν βρέθηκε η κίνηση." };
  if (!movement.outgoing_agent_id) return { error: "Η κίνηση δεν έχει συνεργάτη για εξερχόμενη προμήθεια." };

  // Ακύρωση has no δόση (nothing to collect — it's a refund), so it has
  // no first installment either; its commission is found/anchored via
  // policy_movement_id instead (see migration 0087).
  const installmentId = await getFirstInstallmentId(supabase, movementId);

  const { data: existing } = installmentId
    ? await supabase
        .from("commissions")
        .select("id")
        .eq("policy_installment_id", installmentId)
        .eq("direction", "outgoing")
        .maybeSingle()
    : await supabase
        .from("commissions")
        .select("id")
        .eq("policy_movement_id", movementId)
        .eq("direction", "outgoing")
        .maybeSingle();

  if (existing) {
    await supabase
      .from("commissions")
      .update({ commission_rate_percent: ratePercent, commission_amount: amount, is_manual_override: isManualOverride })
      .eq("id", existing.id);
  } else {
    const payeeId = await getPayeeIdForAgent(supabase, movement.outgoing_agent_id);
    if (!payeeId) return { error: "Ο συνεργάτης δεν έχει αντίστοιχο δικαιούχο προμήθειας." };
    const policy = movement.policies as unknown as { carrier_id: string } | null;
    if (!policy) return { error: "Δεν βρέθηκαν στοιχεία συμβολαίου." };
    await supabase.from("commissions").insert({
      policy_id: movement.policy_id,
      agent_id: movement.outgoing_agent_id,
      carrier_id: policy.carrier_id,
      policy_installment_id: installmentId,
      policy_movement_id: installmentId ? null : movementId,
      commission_type: movement.kind === "renewal" ? "renewal" : movement.kind === "cancellation" ? "cancellation" : "new_business",
      direction: "outgoing",
      payee_id: payeeId,
      base_amount: movement.premium_net,
      commission_rate_percent: ratePercent,
      commission_amount: amount,
      is_manual_override: isManualOverride,
    });
  }

  revalidatePath(`/dashboard/policies/${movement.policy_id}`);
}

// "Βάσει εταιρίας" — the carrier's own agreement-independent reference
// rate (carrier_commission_defaults, new table, see migration 0081).
async function getCarrierDefaultRate(
  supabase: SupabaseServerClient,
  carrierId: string,
  insuranceLineId: string,
): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("carrier_commission_defaults")
    .select("default_percent")
    .eq("carrier_id", carrierId)
    .eq("insurance_line_id", insuranceLineId)
    .lte("valid_from", today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.default_percent ?? null;
}

// "Βάσει σύμβασης" — the actually-applied rate, resolved from the broker
// office's negotiated commission_agreements/carrier_commission_rates
// (unchanged from before this feature: recovered from the pre-removal
// getCommissionRate).
async function getContractRate(
  supabase: SupabaseServerClient,
  brokerOfficeId: string,
  carrierId: string,
  insuranceLineId: string,
): Promise<number | null> {
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

// Outgoing rates are keyed to commission_payees, not agency_users directly
// — every agency_users row is mirrored 1:1 into commission_payees by
// syncPayeeForAgencyUser (settings/actions.ts), so this just follows that
// link.
async function getPayeeIdForAgent(supabase: SupabaseServerClient, agentId: string): Promise<string | null> {
  const { data } = await supabase
    .from("commission_payees")
    .select("id")
    .eq("agency_user_id", agentId)
    .maybeSingle();
  return data?.id ?? null;
}

async function getOutgoingRate(
  supabase: SupabaseServerClient,
  payeeId: string,
  carrierId: string,
  insuranceLineId: string,
): Promise<number | null> {
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

// Creates one policy_movements row plus its installment(s) and incoming
// (+ optional outgoing) commission — the one place that shape gets built,
// shared by createPolicy (new business + renewal, including the
// legacy-chain backfill movement) and createManualMovement's callers.
// Commission insertion is skipped (not zeroed) when no rate resolves,
// matching the old behavior — an admin can still set one by hand later.
export async function createMovementForPolicy(
  supabase: SupabaseServerClient,
  params: {
    policyId: string;
    kind: PolicyMovementKind;
    startDate: string;
    endDate: string;
    premiumNet: number | null;
    premiumGross: number;
    documentNumber: string | null;
    applicationNumber?: string | null;
    issueDate?: string;
    carrierId: string;
    insuranceLineId: string;
    brokerOfficeId: string | null;
    assignedAgentId: string;
    createdBy: string;
  },
): Promise<string | null> {
  const { data: movement, error } = await supabase
    .from("policy_movements")
    .insert({
      policy_id: params.policyId,
      kind: params.kind,
      document_number: params.documentNumber,
      application_number: params.applicationNumber ?? params.documentNumber,
      issue_date: params.issueDate ?? params.startDate,
      start_date: params.startDate,
      end_date: params.endDate,
      premium_net: params.premiumNet,
      premium_gross: params.premiumGross,
      outgoing_agent_id: params.assignedAgentId,
      created_by: params.createdBy,
    })
    .select("id")
    .single();
  if (error || !movement) return null;

  const { data: installment } = await supabase
    .from("policy_installments")
    .insert({
      policy_id: params.policyId,
      movement_id: movement.id,
      installment_number: 1,
      due_date: params.startDate,
      amount: params.premiumGross,
    })
    .select("id")
    .single();

  const baseAmount = params.premiumNet ?? 0;

  const [referenceRatePercent, contractRatePercent] = await Promise.all([
    getCarrierDefaultRate(supabase, params.carrierId, params.insuranceLineId),
    params.brokerOfficeId
      ? getContractRate(supabase, params.brokerOfficeId, params.carrierId, params.insuranceLineId)
      : Promise.resolve(null),
  ]);

  if (installment && (referenceRatePercent != null || contractRatePercent != null)) {
    const appliedRate = contractRatePercent ?? referenceRatePercent ?? 0;
    await supabase.from("commissions").insert({
      policy_id: params.policyId,
      agent_id: params.assignedAgentId,
      carrier_id: params.carrierId,
      policy_installment_id: installment.id,
      commission_type: params.kind === "renewal" ? "renewal" : "new_business",
      direction: "incoming",
      base_amount: baseAmount,
      commission_rate_percent: appliedRate,
      commission_amount: Math.round(((baseAmount * appliedRate) / 100) * 100) / 100,
      reference_rate_percent: referenceRatePercent,
      reference_amount:
        referenceRatePercent != null ? Math.round(((baseAmount * referenceRatePercent) / 100) * 100) / 100 : null,
      period: params.startDate,
    });
  }

  if (installment) {
    const payeeId = await getPayeeIdForAgent(supabase, params.assignedAgentId);
    if (payeeId) {
      const outgoingRate = await getOutgoingRate(supabase, payeeId, params.carrierId, params.insuranceLineId);
      if (outgoingRate != null) {
        await supabase.from("commissions").insert({
          policy_id: params.policyId,
          agent_id: params.assignedAgentId,
          carrier_id: params.carrierId,
          policy_installment_id: installment.id,
          commission_type: params.kind === "renewal" ? "renewal" : "new_business",
          direction: "outgoing",
          payee_id: payeeId,
          base_amount: baseAmount,
          commission_rate_percent: outgoingRate,
          commission_amount: Math.round(((baseAmount * outgoingRate) / 100) * 100) / 100,
          period: params.startDate,
        });
      }
    }
  }

  return movement.id;
}

// Καταχώρηση είσπραξης — one payment against one installment. Extends the
// original collectInstallmentPayment (recovered from git history) with
// cheque fields and the "Συμψηφισμός εξερχόμενων προμηθειών" checkbox,
// which nets the outgoing commission off the collected amount instead of
// paying it separately (purely informational on the movement — no separate
// ledger row for the offset itself, matches how Profia just shows it as a
// checkbox next to the collection).
export async function collectInstallmentPayment(policyId: string, installmentId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const { data: installment } = await supabase
    .from("policy_installments")
    .select("policy_id, movement_id, installment_number, due_date, amount, paid_amount, policies!inner(client_id)")
    .eq("id", installmentId)
    .single();
  if (!installment) return;

  const remainingDue = installmentRemaining(installment);
  const enteredRaw = formData.get("paid_amount");
  const entered = enteredRaw !== null && enteredRaw !== "" ? Number(enteredRaw) : NaN;
  const newPayment = Number.isFinite(entered) && entered > 0 ? entered : remainingDue;
  if (newPayment <= 0) return;

  const paymentMethodId = str(formData, "payment_method_id");
  const receiptNumber = str(formData, "receipt_number");
  const chequeBank = str(formData, "cheque_bank");
  const chequeNumber = str(formData, "cheque_number");
  const chequeDueDate = str(formData, "cheque_due_date");

  // A payment that doesn't clear the δόση's whole remaining balance closes
  // THIS δόση at exactly what's been collected on it — so it shows "paid"
  // for the amount actually given — and opens a new pending δόση for what's
  // left, so every partial collection is its own visible row (amount +
  // date) instead of an invisible running total on one row. Only applies to
  // movement-scoped δόσεις (always true for this action's only caller); a
  // payment that fully settles (or overpays/tips) never splits.
  const remainder = Math.round((remainingDue - newPayment) * 100) / 100;
  const shouldSplit = remainder > 0 && Boolean(installment.movement_id);
  if (shouldSplit) {
    const settledAmount = Math.round(((installment.paid_amount ?? 0) + newPayment) * 100) / 100;
    await supabase.from("policy_installments").update({ amount: settledAmount }).eq("id", installmentId);
  }

  const { error } = await supabase.from("installment_payments").insert({
    installment_id: installmentId,
    amount: Math.round(newPayment * 100) / 100,
    payment_method_id: paymentMethodId,
    receipt_number: receiptNumber,
    paid_by: agencyUser.id,
    cheque_bank: chequeBank,
    cheque_number: chequeNumber,
    cheque_due_date: chequeDueDate,
  });
  if (error) return;

  if (shouldSplit && installment.movement_id) {
    const { data: lastNumbered } = await supabase
      .from("policy_installments")
      .select("installment_number")
      .eq("movement_id", installment.movement_id)
      .order("installment_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase.from("policy_installments").insert({
      policy_id: installment.policy_id,
      movement_id: installment.movement_id,
      installment_number: (lastNumbered?.installment_number ?? installment.installment_number) + 1,
      due_date: installment.due_date,
      amount: remainder,
    });
  }

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
  revalidatePath("/dashboard/remittances");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  if (collectClientId) revalidatePath(`/dashboard/clients/${collectClientId}`);
  updateTag(CACHE_TAGS.reports);
}

// "Αλλαγή Δόσεων" — fixes a mistaken δόση (wrong amount/due date, whether
// hand-entered or produced by the auto-split above). Admin/owner only,
// same boundary as every other financial adjustment in this file. Doesn't
// touch paid_amount (that stays the ledger's rollup) — only recomputes
// status against the new amount, same 3-way rule the DB trigger uses
// (recompute_installment_rollup, migration 0045), so editing a δόση after
// the fact still leaves it in a consistent state.
export async function updateInstallment(
  installmentId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const amount = num(formData, "amount");
  const dueDate = str(formData, "due_date");
  if (amount === null || amount < 0 || !dueDate) {
    return { error: "Συμπλήρωσε έγκυρο ποσό και ημερομηνία." };
  }

  const { data: installment } = await supabase
    .from("policy_installments")
    .select("policy_id, paid_amount")
    .eq("id", installmentId)
    .single();
  if (!installment) return { error: "Δεν βρέθηκε η δόση." };

  const paid = installment.paid_amount ?? 0;
  const status = paid <= 0 ? "pending" : paid < amount ? "partially_paid" : "paid";

  await supabase
    .from("policy_installments")
    .update({ amount, due_date: dueDate, status })
    .eq("id", installmentId);

  revalidatePath(`/dashboard/policies/${installment.policy_id}`);
}

// Deleting a δόση is only allowed while nothing has been collected against
// it yet (a wrongly created/split row) — once real money is attached, the
// permanent installment_payments ledger (migration 0045) shouldn't be
// silently cascaded away, so removal is blocked at the app level (not just
// relying on the FK on commissions.policy_installment_id, which only
// protects the movement's first δόση).
export async function deleteInstallment(installmentId: string): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const { data: installment } = await supabase
    .from("policy_installments")
    .select("policy_id, paid_amount")
    .eq("id", installmentId)
    .single();
  if (!installment) return { error: "Δεν βρέθηκε η δόση." };
  if ((installment.paid_amount ?? 0) > 0) {
    return { error: "Δεν μπορεί να διαγραφεί δόση με καταχωρημένη είσπραξη." };
  }

  const { error } = await supabase.from("policy_installments").delete().eq("id", installmentId);
  if (error) return { error: "Δεν ήταν δυνατή η διαγραφή — υπάρχει συνδεδεμένη προμήθεια." };

  revalidatePath(`/dashboard/policies/${installment.policy_id}`);
}

// Απόδοση ασφαλίστρων / εξερχόμενων προμηθειών — a reversible toggle
// (clicking again clears the timestamp), admin-only per the RLS policy on
// policy_movements.
export async function togglePremiumRemittance(movementId: string, currentlyRemitted: boolean) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();
  await supabase
    .from("policy_movements")
    .update({ premium_remitted_at: currentlyRemitted ? null : new Date().toISOString() })
    .eq("id", movementId);
  revalidatePath("/dashboard/remittances");
}

export async function toggleOutgoingCommissionRemittance(movementId: string, currentlyRemitted: boolean) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();
  await supabase
    .from("policy_movements")
    .update({ outgoing_commission_remitted_at: currentlyRemitted ? null : new Date().toISOString() })
    .eq("id", movementId);
  revalidatePath("/dashboard/remittances");
}

// Μεταφορά παραστατικού σε άλλο συμβόλαιο — admin only. Basic existence
// check on the target; no other validation (matches Profia, which lets the
// user move a document freely between contracts).
export async function transferMovement(
  movementId: string,
  targetPolicyId: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const { data: target } = await supabase.from("policies").select("id").eq("id", targetPolicyId).maybeSingle();
  if (!target) return { error: "Δεν βρέθηκε το συμβόλαιο-στόχος." };

  const { data: movement } = await supabase
    .from("policy_movements")
    .select("policy_id")
    .eq("id", movementId)
    .single();
  if (!movement) return { error: "Δεν βρέθηκε η κίνηση." };

  await supabase.from("policy_movements").update({ policy_id: targetPolicyId }).eq("id", movementId);
  revalidatePath(`/dashboard/policies/${movement.policy_id}`);
  revalidatePath(`/dashboard/policies/${targetPolicyId}`);
}

// Διαγραφή κίνησης — admin/owner only, and only while nothing's been
// remitted and nothing's been collected against any of its δόσεις yet
// (same principle as deleting a single δόση, scaled to the whole
// movement) — protects the permanent installment_payments ledger and
// already-settled remittances from being silently wiped. None of
// commissions/referral_rewards/policy_installments cascade off
// policy_movements, so children are removed first, in FK-safe order.
export async function deleteMovement(movementId: string): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Δεν έχεις δικαίωμα για αυτή την ενέργεια." };
  }
  const supabase = await createSupabaseClient();

  const { data: movement } = await supabase
    .from("policy_movements")
    .select("policy_id, premium_remitted_at, outgoing_commission_remitted_at")
    .eq("id", movementId)
    .single();
  if (!movement) return { error: "Δεν βρέθηκε η κίνηση." };
  if (movement.premium_remitted_at || movement.outgoing_commission_remitted_at) {
    return { error: "Δεν μπορεί να διαγραφεί κίνηση που έχει ήδη αποδοθεί." };
  }

  const { data: installments } = await supabase
    .from("policy_installments")
    .select("id, paid_amount")
    .eq("movement_id", movementId);
  if ((installments ?? []).some((i) => (i.paid_amount ?? 0) > 0)) {
    return { error: "Δεν μπορεί να διαγραφεί κίνηση με καταχωρημένη είσπραξη." };
  }

  const installmentIds = (installments ?? []).map((i) => i.id);
  if (installmentIds.length) {
    await supabase.from("commissions").delete().in("policy_installment_id", installmentIds);
  }
  // Ακύρωση commissions have no installment to hang off (see migration
  // 0087) — anchored via policy_movement_id instead, so they need their
  // own delete regardless of whether the movement had any installments.
  await supabase.from("commissions").delete().eq("policy_movement_id", movementId);
  await supabase.from("referral_rewards").delete().eq("policy_movement_id", movementId);
  await supabase.from("policy_installments").delete().eq("movement_id", movementId);

  const { error } = await supabase.from("policy_movements").delete().eq("id", movementId);
  if (error) return { error: "Δεν ήταν δυνατή η διαγραφή της κίνησης." };

  revalidatePath(`/dashboard/policies/${movement.policy_id}`);
}

// Νέα Κίνηση — a manual, ledger-only movement (mainly "Πρόσθετη πράξη" or a
// manually-recorded "Ακύρωση"), independent of policy coverage-detail
// edits. Carries the policy's own assigned agent as outgoing_agent_id —
// same as createMovementForPolicy — so it shows up in the Κινήσεις list's
// Συνεργάτης column like every other movement kind.
//
// Ακύρωση is a refund to the client, not a receivable: its premium is
// always stored negative (migration 0084 relaxed the >=0 check just for
// this kind) and it gets NO policy_installments row — there's nothing to
// collect via Είσπραξη, only money owed back. Instead it gets its own
// negative incoming/outgoing commission clawback, at the same rate that
// would normally apply, computed off the same negative base (migrations
// 0085/0086 added the 'cancellation' commission_type and relaxed its own
// amount check the same way). Every other kind (endorsement) keeps the
// original one-installment, no-commission behavior unchanged.
export async function createManualMovement(
  policyId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const kind = str(formData, "kind") as PolicyMovementKind | null;
  const startDate = str(formData, "start_date");
  const endDate = str(formData, "end_date");
  const premiumGrossInput = num(formData, "premium_gross");

  if (!kind || !startDate || !endDate || premiumGrossInput === null) {
    return { error: "Συμπλήρωσε είδος, ημερομηνίες και μικτό ασφάλιστρο." };
  }

  const isCancellation = kind === "cancellation";
  const premiumGross = isCancellation ? -Math.abs(premiumGrossInput) : premiumGrossInput;
  const premiumNetInput = num(formData, "premium_net");
  const premiumNet =
    premiumNetInput === null ? null : isCancellation ? -Math.abs(premiumNetInput) : premiumNetInput;

  const { data: policy } = await supabase
    .from("policies")
    .select("assigned_agent_id, carrier_id, insurance_line_id, broker_office_id")
    .eq("id", policyId)
    .single();

  const { data: movement, error } = await supabase
    .from("policy_movements")
    .insert({
      policy_id: policyId,
      kind,
      document_number: str(formData, "document_number"),
      start_date: startDate,
      end_date: endDate,
      premium_net: premiumNet,
      premium_gross: premiumGross,
      description: str(formData, "description"),
      notes: str(formData, "notes"),
      outgoing_agent_id: policy?.assigned_agent_id ?? null,
      created_by: agencyUser.id,
    })
    .select("id")
    .single();

  if (error || !movement) return { error: "Σφάλμα κατά τη δημιουργία κίνησης." };

  if (isCancellation && policy) {
    const baseAmount = premiumNet ?? premiumGross;
    const [referenceRatePercent, contractRatePercent] = await Promise.all([
      getCarrierDefaultRate(supabase, policy.carrier_id, policy.insurance_line_id),
      policy.broker_office_id
        ? getContractRate(supabase, policy.broker_office_id, policy.carrier_id, policy.insurance_line_id)
        : Promise.resolve(null),
    ]);
    const appliedRate = contractRatePercent ?? referenceRatePercent ?? 0;
    if (referenceRatePercent != null || contractRatePercent != null) {
      await supabase.from("commissions").insert({
        policy_id: policyId,
        agent_id: policy.assigned_agent_id ?? agencyUser.id,
        carrier_id: policy.carrier_id,
        policy_movement_id: movement.id,
        commission_type: "cancellation",
        direction: "incoming",
        base_amount: baseAmount,
        commission_rate_percent: appliedRate,
        commission_amount: Math.round(((baseAmount * appliedRate) / 100) * 100) / 100,
        reference_rate_percent: referenceRatePercent,
        reference_amount:
          referenceRatePercent != null ? Math.round(((baseAmount * referenceRatePercent) / 100) * 100) / 100 : null,
        period: startDate,
      });
    }

    if (policy.assigned_agent_id) {
      const payeeId = await getPayeeIdForAgent(supabase, policy.assigned_agent_id);
      if (payeeId) {
        const outgoingRate = await getOutgoingRate(supabase, payeeId, policy.carrier_id, policy.insurance_line_id);
        if (outgoingRate != null) {
          await supabase.from("commissions").insert({
            policy_id: policyId,
            agent_id: policy.assigned_agent_id,
            carrier_id: policy.carrier_id,
            policy_movement_id: movement.id,
            commission_type: "cancellation",
            direction: "outgoing",
            payee_id: payeeId,
            base_amount: baseAmount,
            commission_rate_percent: outgoingRate,
            commission_amount: Math.round(((baseAmount * outgoingRate) / 100) * 100) / 100,
            period: startDate,
          });
        }
      }
    }
  } else {
    await supabase.from("policy_installments").insert({
      policy_id: policyId,
      movement_id: movement.id,
      installment_number: 1,
      due_date: startDate,
      amount: premiumGross,
    });
  }

  if (kind === "cancellation") {
    await supabase.from("policies").update({ status: "cancelled", status_auto_managed: false }).eq("id", policyId);
  }

  await logActivity(supabase, {
    entityType: "policy",
    entityId: policyId,
    action: "movement_created",
    description: `Καταχωρήθηκε κίνηση: ${POLICY_MOVEMENT_KIND_LABELS[kind] ?? kind}.`,
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/policies/${policyId}`);
}
