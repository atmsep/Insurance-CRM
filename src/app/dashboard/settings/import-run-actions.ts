"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "./actions";
import { parseXlsx, parseCsv, type Sheet } from "@/lib/import-bridges/parse";
import { parseSlk, isSlk, isLegacyBinaryXls } from "@/lib/import-bridges/slk";
import { mapRows, suggestMappings, type FieldMapping } from "@/lib/import-bridges/map";
import type { BridgeKind } from "@/lib/import-bridges/fields";
import type { CodeDimension } from "@/lib/import-bridges/codes";
import {
  planRows,
  emptyCodeIndex,
  type CodeIndex,
  type PlannedRow,
  type UnknownCode,
} from "@/lib/import-bridges/plan";
import {
  planClientMerge,
  appendNotes,
  type ClientValues,
} from "@/lib/import-bridges/client-merge";
import { createMovementForPolicy } from "@/app/dashboard/policies/movements-actions";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const LOOKUP_CHUNK = 200;

export type ImportIssue = { rowNumber: number; severity: "error" | "warning"; message: string };

export type ImportRunResult =
  | { error: string }
  | {
      applied: boolean;
      runId: string | null;
      totalRows: number;
      counts: { ready: number; blocked: number; ignored: number };
      unknownCodes: UnknownCode[];
      matched: number;
      unmatched: number;
      movementsCreated: number;
      policiesCreated: number;
      policiesRenewed: number;
      policiesCancelled: number;
      clientsCreated: number;
      clientsFilled: number;
      clientNoteLines: number;
      skippedDuplicates: number;
      issues: ImportIssue[];
    };

type BridgeRow = {
  id: string;
  name: string;
  kind: BridgeKind;
  carrier_id: string | null;
  broker_office_id: string | null;
  file_format: string;
  sheet_name: string | null;
  header_row: number;
  csv_delimiter: string | null;
  date_format: string;
  decimal_separator: string;
};

async function readSheet(file: File, bridge: BridgeRow): Promise<Sheet> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isLegacyBinaryXls(bytes)) {
    throw new Error(
      `Το «${file.name}» είναι παλιό δυαδικό Excel και δεν υποστηρίζεται. Αποθήκευσέ το ως .xlsx ή .csv.`,
    );
  }
  if (isSlk(bytes)) {
    return parseSlk(bytes.buffer as ArrayBuffer, { headerRow: bridge.header_row });
  }
  const lower = file.name.toLowerCase();
  if (bridge.file_format === "csv" || lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsv(await file.text(), {
      delimiter: bridge.csv_delimiter,
      headerRow: bridge.header_row,
    });
  }
  return parseXlsx(bytes.buffer as ArrayBuffer, {
    sheetName: bridge.sheet_name,
    headerRow: bridge.header_row,
  });
}

type Supabase = Awaited<ReturnType<typeof createSupabaseClient>>;

async function loadMappings(supabase: Supabase, bridge: BridgeRow, sheet: Sheet): Promise<FieldMapping[]> {
  const { data } = await supabase
    .from("import_bridge_fields")
    .select("target_field, source_column, source_index, transform, constant_value")
    .eq("bridge_id", bridge.id);
  if (data && data.length) {
    return data.map((s) => ({
      targetField: s.target_field,
      sourceColumn: s.source_column,
      sourceIndex: s.source_index,
      transform: s.transform,
      constantValue: s.constant_value,
    }));
  }
  return suggestMappings(sheet.headers, bridge.kind);
}

async function loadCodeIndex(supabase: Supabase, bridgeId: string): Promise<CodeIndex> {
  const index = emptyCodeIndex();
  const { data } = await supabase
    .from("import_bridge_code_maps")
    .select("dimension, source_code, carrier_id, insurance_line_id, agency_user_id, payment_method_id, target_value, is_ignored")
    .eq("bridge_id", bridgeId);

  for (const row of data ?? []) {
    const dimension = row.dimension as CodeDimension;
    if (row.is_ignored) {
      index[dimension].set(row.source_code, { kind: "ignored" });
      continue;
    }
    const value =
      row.carrier_id ?? row.insurance_line_id ?? row.agency_user_id ?? row.payment_method_id ?? row.target_value;
    if (value) index[dimension].set(row.source_code, { kind: "target", value });
  }
  return index;
}

// Η συχνότητα πληρωμής είναι NOT NULL στα συμβόλαια. Το αρχείο σπάνια τη
// φέρνει, οπότε συνάγεται από τη διάρκεια της περιόδου — που είναι ακριβώς
// ό,τι θα έλεγε και ο άνθρωπος κοιτώντας τη γραμμή.
function inferPaymentFrequency(startDate: string, endDate: string): string {
  const days = Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000,
  );
  if (!Number.isFinite(days) || days <= 0) return "annual";
  if (days <= 45) return "monthly";
  if (days <= 135) return "quarterly";
  if (days <= 250) return "semiannual";
  return "annual";
}

/** «ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ» -> επώνυμο + όνομα, με τη σειρά που γράφει το γραφείο. */
function splitName(full: string): { lastName: string; firstName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { lastName: parts[0], firstName: "-" };
  return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Τα στοιχεία πελάτη μιας γραμμής, από όποιο αρχείο κι αν ήρθαν. */
function clientValuesFrom(values: Record<string, string | number | null>): ClientValues {
  return {
    phone_mobile: str(values.client_phone) || null,
    phone_landline: str(values.client_landline) || null,
    email: str(values.client_email) || null,
    afm: str(values.client_afm) || null,
    doy: str(values.client_doy) || null,
    address_street: str(values.client_address) || null,
    address_city: str(values.client_city) || null,
    address_postal_code: str(values.client_postal_code) || null,
  };
}

export async function runImport(bridgeId: string, formData: FormData): Promise<ImportRunResult> {
  const agencyUser = await requireAdmin();
  const supabase = await createSupabaseClient();

  const apply = formData.get("apply") === "1";
  const allowCreate = formData.get("create_missing") === "1";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Επίλεξε αρχείο." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Το αρχείο ξεπερνά τα 15MB." };

  const { data: bridge } = await supabase
    .from("import_bridges")
    .select("id, name, kind, carrier_id, broker_office_id, file_format, sheet_name, header_row, csv_delimiter, date_format, decimal_separator")
    .eq("id", bridgeId)
    .maybeSingle();
  if (!bridge) return { error: "Δεν βρέθηκε η γέφυρα." };
  const typedBridge = bridge as BridgeRow;
  if (typedBridge.kind !== "production") {
    return { error: "Προς το παρόν εφαρμόζεται μόνο η «Παραγωγή / Χαρτοφυλάκιο»." };
  }

  let sheet: Sheet;
  try {
    sheet = await readSheet(file, typedBridge);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (!sheet.headers.length) return { error: "Δεν βρέθηκαν στήλες στο αρχείο." };

  const mappings = await loadMappings(supabase, typedBridge, sheet);
  const mapped = mapRows(
    sheet.headers,
    sheet.rows,
    mappings,
    {
      kind: "production",
      dateFormat: typedBridge.date_format,
      decimalSeparator: typedBridge.decimal_separator,
    },
    typedBridge.header_row + 1,
  );

  const codes = await loadCodeIndex(supabase, bridgeId);
  const plan = planRows(mapped, codes, {
    defaultCarrierId: typedBridge.carrier_id,
    requiredDimensions: ["carrier", "movement_kind"],
  });

  // Το συνοδευτικό πελατολόγιο, αν ανέβηκε: διαβάζεται με τη γέφυρα
  // «Πελατολόγιο» του ίδιου ιδιοκτήτη.
  const clientsByCode = new Map<string, Record<string, string | number | null>>();
  const clientsFile = formData.get("clients_file");
  if (clientsFile instanceof File && clientsFile.size > 0) {
    const ownerFilter = typedBridge.carrier_id
      ? { column: "carrier_id", value: typedBridge.carrier_id }
      : { column: "broker_office_id", value: typedBridge.broker_office_id! };
    const { data: clientBridge } = await supabase
      .from("import_bridges")
      .select("id, name, kind, carrier_id, broker_office_id, file_format, sheet_name, header_row, csv_delimiter, date_format, decimal_separator")
      .eq("kind", "clients")
      .eq("is_active", true)
      .eq(ownerFilter.column, ownerFilter.value)
      .maybeSingle();
    if (!clientBridge) {
      return {
        error:
          "Ανέβασες αρχείο πελατολογίου αλλά δεν υπάρχει ενεργή γέφυρα «Πελατολόγιο» για τον ίδιο ιδιοκτήτη. Φτιάξε την πρώτα.",
      };
    }
    const cBridge = clientBridge as BridgeRow;
    let cSheet: Sheet;
    try {
      cSheet = await readSheet(clientsFile, cBridge);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
    const cMappings = await loadMappings(supabase, cBridge, cSheet);
    const cMapped = mapRows(
      cSheet.headers,
      cSheet.rows,
      cMappings,
      { kind: "clients", dateFormat: cBridge.date_format, decimalSeparator: cBridge.decimal_separator },
      cBridge.header_row + 1,
    );
    for (const row of cMapped) {
      const code = str(row.values.client_code);
      if (code) clientsByCode.set(code, row.values);
    }
  }

  const issues: ImportIssue[] = [];
  for (const row of plan.rows) {
    if (row.status === "blocked") {
      issues.push({ rowNumber: row.rowNumber, severity: "error", message: row.reasons.join(" · ") });
    }
  }

  // --- Ταύτιση με υπάρχοντα συμβόλαια -------------------------------------
  const ready = plan.rows.filter((r) => r.status === "ready" && r.policyNumber);
  const numbers = [...new Set(ready.map((r) => r.policyNumber!))];
  type ExistingPolicy = {
    id: string;
    policy_number: string;
    carrier_id: string;
    client_id: string;
    renewal_number: number;
    status: string;
    start_date: string;
    end_date: string;
    premium_net: number | null;
    premium_gross: number;
    assigned_agent_id: string | null;
    created_by: string | null;
    insurance_line_id: string;
    broker_office_id: string | null;
  };
  const existing = new Map<string, ExistingPolicy>();
  for (let i = 0; i < numbers.length; i += LOOKUP_CHUNK) {
    const { data } = await supabase
      .from("policies")
      .select(
        "id, policy_number, carrier_id, client_id, renewal_number, status, start_date, end_date, premium_net, premium_gross, assigned_agent_id, created_by, insurance_line_id, broker_office_id",
      )
      .in("policy_number", numbers.slice(i, i + LOOKUP_CHUNK));
    for (const p of (data ?? []) as ExistingPolicy[]) {
      existing.set(`${p.carrier_id} ${p.policy_number}`, p);
    }
  }

  // Οι υπάρχουσες κινήσεις των συμβολαίων που ταιριάξαμε, μαζεμένες μία
  // φορά: αλλιώς κάθε γραμμή θα έκανε δικό της ερώτημα και ένα αρχείο με
  // χιλιάδες γραμμές θα έριχνε τη σελίδα σε timeout.
  const policyIds = [...new Set([...existing.values()].map((p) => p.id))];
  const movementKeys = new Set<string>();
  const policiesWithMovements = new Set<string>();
  for (let i = 0; i < policyIds.length; i += LOOKUP_CHUNK) {
    const { data } = await supabase
      .from("policy_movements")
      .select("policy_id, kind, start_date")
      .in("policy_id", policyIds.slice(i, i + LOOKUP_CHUNK));
    for (const m of data ?? []) {
      movementKeys.add(`${m.policy_id} ${m.kind} ${m.start_date}`);
      policiesWithMovements.add(m.policy_id);
    }
  }

  const stats = {
    matched: 0,
    unmatched: 0,
    movementsCreated: 0,
    policiesCreated: 0,
    policiesRenewed: 0,
    policiesCancelled: 0,
    clientsCreated: 0,
    clientsFilled: 0,
    clientNoteLines: 0,
    skippedDuplicates: 0,
  };

  const today = new Date().toISOString().slice(0, 10);
  const mergeContext = { sourceName: typedBridge.name, date: today };

  for (const row of ready) {
    const key = `${row.carrierId} ${row.policyNumber}`;
    const policy = existing.get(key);

    if (policy) {
      stats.matched++;
      await handleMatched(row, policy);
    } else {
      stats.unmatched++;
      await handleUnmatched(row);
    }
  }

  // --- Καταγραφή εκτέλεσης ------------------------------------------------
  let runId: string | null = null;
  if (apply) {
    const { data: run } = await supabase
      .from("import_runs")
      .insert({
        bridge_id: bridgeId,
        file_name: file.name,
        file_size_bytes: file.size,
        status: "applied",
        rows_total: plan.rows.length,
        rows_created: stats.policiesCreated + stats.movementsCreated,
        rows_updated: stats.policiesRenewed + stats.clientsFilled,
        rows_skipped: plan.counts.ignored + stats.skippedDuplicates,
        rows_failed: plan.counts.blocked,
        summary: { ...stats, unknownCodes: plan.unknownCodes },
        finished_at: new Date().toISOString(),
        created_by: agencyUser.id,
      })
      .select("id")
      .single();
    runId = run?.id ?? null;

    if (runId && issues.length) {
      for (let i = 0; i < issues.length; i += LOOKUP_CHUNK) {
        await supabase.from("import_run_issues").insert(
          issues.slice(i, i + LOOKUP_CHUNK).map((x) => ({
            run_id: runId,
            row_number: x.rowNumber,
            severity: x.severity,
            message: x.message,
          })),
        );
      }
    }
    revalidatePath("/dashboard/policies");
    revalidatePath("/dashboard/settings");
  }

  return {
    applied: apply,
    runId,
    totalRows: plan.rows.length,
    counts: plan.counts,
    unknownCodes: plan.unknownCodes,
    ...stats,
    issues: issues.slice(0, 200),
  };

  // -------------------------------------------------------------------------

  async function handleMatched(row: PlannedRow, policy: ExistingPolicy) {
    const startDate = str(row.values.start_date);
    const endDate = str(row.values.end_date);
    const premiumGross = Number(row.values.premium_gross ?? 0);
    const premiumNet = row.values.premium_net == null ? null : Number(row.values.premium_net);

    // Το ίδιο αρχείο μπορεί να ανέβει δεύτερη φορά — δεν διπλογράφουμε.
    const movementKey = `${policy.id} ${row.movementKind} ${startDate}`;
    if (movementKeys.has(movementKey)) {
      stats.skippedDuplicates++;
      issues.push({
        rowNumber: row.rowNumber,
        severity: "warning",
        message: `Υπάρχει ήδη κίνηση ${row.movementKind} με έναρξη ${startDate} — παραλείφθηκε.`,
      });
      return;
    }

    await mergeClient(row, policy.client_id);

    if (row.movementKind === "policy") {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "warning",
        message: "Το αρχείο το δηλώνει ως νέο, αλλά ο αριθμός συμβολαίου υπάρχει ήδη — παραλείφθηκε.",
      });
      stats.skippedDuplicates++;
      return;
    }

    if (!apply) {
      stats.movementsCreated++;
      if (row.movementKind === "renewal") stats.policiesRenewed++;
      if (row.movementKind === "cancellation") stats.policiesCancelled++;
      return;
    }

    // Παλιά συμβόλαια χωρίς καμία κίνηση: καταγράφεται πρώτα η τρέχουσα
    // κατάστασή τους, αλλιώς η ανανέωση θα την έσβηνε χωρίς ίχνος. Ίδια
    // λογική με τη χειροκίνητη ανανέωση (policies/actions.ts).
    if (!policiesWithMovements.has(policy.id)) {
      await supabase.from("policy_movements").insert({
        policy_id: policy.id,
        kind: policy.renewal_number > 1 ? "renewal" : "policy",
        document_number: `${policy.policy_number}/${policy.renewal_number}`,
        issue_date: policy.start_date,
        start_date: policy.start_date,
        end_date: policy.end_date,
        premium_net: policy.premium_net,
        premium_gross: policy.premium_gross,
        outgoing_agent_id: policy.assigned_agent_id,
        created_by: policy.created_by ?? agencyUser.id,
      });
      policiesWithMovements.add(policy.id);
    }

    const agentId = row.agentId ?? policy.assigned_agent_id ?? agencyUser.id;

    if (row.movementKind === "renewal") {
      await supabase
        .from("policies")
        .update({
          issue_date: str(row.values.issue_date) || startDate,
          start_date: startDate,
          end_date: endDate,
          premium_gross: premiumGross,
          premium_net: premiumNet,
          renewal_number: policy.renewal_number + 1,
          is_renewal: true,
          status: "active",
          status_auto_managed: true,
          // Οι υπενθυμίσεις ανανέωσης ξαναοπλίζονται για τη νέα περίοδο.
          renewal_notice_30d_sent_at: null,
          renewal_notice_7d_sent_at: null,
        })
        .eq("id", policy.id);
      stats.policiesRenewed++;
    }

    if (row.movementKind === "cancellation") {
      await supabase
        .from("policies")
        .update({ status: "cancelled", status_auto_managed: false })
        .eq("id", policy.id);
      stats.policiesCancelled++;
    }

    const movementId = await createMovementForPolicy(supabase, {
      policyId: policy.id,
      kind: row.movementKind as "policy" | "renewal" | "endorsement" | "cancellation",
      startDate,
      endDate,
      premiumNet,
      premiumGross,
      documentNumber: str(row.values.document_number) || row.policyNumber,
      applicationNumber: str(row.values.application_number) || null,
      issueDate: str(row.values.issue_date) || startDate,
      carrierId: row.carrierId!,
      insuranceLineId: row.insuranceLineId ?? policy.insurance_line_id,
      brokerOfficeId: typedBridge.broker_office_id ?? policy.broker_office_id,
      assignedAgentId: agentId,
      createdBy: agencyUser.id,
      paymentFrequency: inferPaymentFrequency(startDate, endDate),
    });
    if (movementId) stats.movementsCreated++;
    else {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "error",
        message: "Η κίνηση δεν καταχωρήθηκε.",
      });
    }
  }

  async function handleUnmatched(row: PlannedRow) {
    if (!allowCreate) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "warning",
        message: `Δεν βρέθηκε συμβόλαιο «${row.policyNumber}» σε αυτή την εταιρεία — δεν δημιουργήθηκε.`,
      });
      return;
    }
    if (!row.insuranceLineId) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "error",
        message: "Για να δημιουργηθεί συμβόλαιο χρειάζεται αντιστοιχισμένος κλάδος.",
      });
      return;
    }

    const clientId = await resolveOrCreateClient(row);
    if (!clientId) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "error",
        message: "Δεν βρέθηκε ούτε δημιουργήθηκε πελάτης για τη γραμμή.",
      });
      return;
    }

    const startDate = str(row.values.start_date);
    const endDate = str(row.values.end_date);
    const premiumGross = Number(row.values.premium_gross ?? 0);
    const premiumNet = row.values.premium_net == null ? null : Number(row.values.premium_net);
    const agentId = row.agentId ?? agencyUser.id;

    if (!apply) {
      stats.policiesCreated++;
      stats.movementsCreated++;
      return;
    }

    const { data: created, error } = await supabase
      .from("policies")
      .insert({
        policy_number: row.policyNumber,
        client_id: clientId,
        carrier_id: row.carrierId,
        insurance_line_id: row.insuranceLineId,
        assigned_agent_id: agentId,
        broker_office_id: typedBridge.broker_office_id,
        issue_date: str(row.values.issue_date) || startDate,
        start_date: startDate,
        end_date: endDate,
        premium_gross: premiumGross,
        premium_net: premiumNet,
        payment_frequency: inferPaymentFrequency(startDate, endDate),
        risk_label: str(row.values.risk_label) || null,
        status: row.movementKind === "cancellation" ? "cancelled" : "active",
        created_by: agencyUser.id,
      })
      .select("id")
      .single();

    if (error || !created) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "error",
        message: "Σφάλμα δημιουργίας συμβολαίου: " + (error?.message ?? ""),
      });
      return;
    }
    stats.policiesCreated++;

    const movementId = await createMovementForPolicy(supabase, {
      policyId: created.id,
      kind: (row.movementKind as "policy" | "renewal" | "endorsement" | "cancellation") ?? "policy",
      startDate,
      endDate,
      premiumNet,
      premiumGross,
      documentNumber: str(row.values.document_number) || row.policyNumber,
      applicationNumber: str(row.values.application_number) || null,
      issueDate: str(row.values.issue_date) || startDate,
      carrierId: row.carrierId!,
      insuranceLineId: row.insuranceLineId,
      brokerOfficeId: typedBridge.broker_office_id,
      assignedAgentId: agentId,
      createdBy: agencyUser.id,
      paymentFrequency: inferPaymentFrequency(startDate, endDate),
    });
    if (movementId) stats.movementsCreated++;
  }

  /** Τα στοιχεία της γραμμής, ενισχυμένα από το συνοδευτικό πελατολόγιο. */
  function incomingClientValues(row: PlannedRow): { values: ClientValues; name: string; afm: string } {
    const fromClientsFile = row.clientCode ? clientsByCode.get(row.clientCode) : undefined;
    const merged: Record<string, string | number | null> = { ...(fromClientsFile ?? {}), ...row.values };
    // Ό,τι λείπει από τη γραμμή παραγωγής το συμπληρώνει το πελατολόγιο.
    if (fromClientsFile) {
      for (const [k, v] of Object.entries(fromClientsFile)) {
        if (!str(merged[k]) && str(v)) merged[k] = v;
      }
    }
    return {
      values: clientValuesFrom(merged),
      name: str(merged.client_name),
      afm: str(merged.client_afm),
    };
  }

  // ΚΑΝΟΝΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ: τα στοιχεία που έχει ήδη η καρτέλα ΔΕΝ αλλάζουν.
  // Ό,τι λείπει συμπληρώνεται· ό,τι διαφέρει καταγράφεται στις σημειώσεις.
  async function mergeClient(row: PlannedRow, clientId: string) {
    const incoming = incomingClientValues(row);
    const hasSomething = Object.values(incoming.values).some((v) => str(v));
    if (!hasSomething) return;

    const { data: client } = await supabase
      .from("clients")
      .select("id, afm, doy, email, phone_mobile, phone_landline, address_street, address_city, address_postal_code, notes")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return;

    const merge = planClientMerge(client as ClientValues, incoming.values, mergeContext);
    if (!Object.keys(merge.fill).length && !merge.noteLines.length) return;

    stats.clientNoteLines += merge.noteLines.length;
    if (Object.keys(merge.fill).length) stats.clientsFilled++;
    if (!apply) return;

    const currentNotes = (client as { notes: string | null }).notes;
    const notes = appendNotes(currentNotes, merge.noteLines);
    await supabase
      .from("clients")
      .update({ ...merge.fill, ...(notes !== currentNotes ? { notes } : {}) })
      .eq("id", clientId);
  }

  async function resolveOrCreateClient(row: PlannedRow): Promise<string | null> {
    const incoming = incomingClientValues(row);

    // Το ΑΦΜ είναι το μόνο ασφαλές κλειδί ταύτισης· το όνομα μόνο ως εφεδρεία.
    if (incoming.afm) {
      const { data } = await supabase.from("clients").select("id").eq("afm", incoming.afm).maybeSingle();
      if (data) {
        await mergeClient(row, data.id);
        return data.id;
      }
    }
    if (incoming.name) {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .ilike("display_name", incoming.name)
        .limit(2);
      if (data && data.length === 1) {
        await mergeClient(row, data[0].id);
        return data[0].id;
      }
      if (data && data.length > 1) return null; // αμφίσημο — δεν μαντεύουμε
    }

    if (!incoming.name) return null;
    if (!apply) {
      stats.clientsCreated++;
      return "preview";
    }

    const { lastName, firstName } = splitName(incoming.name);
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        client_type: "individual",
        display_name: incoming.name,
        afm: incoming.afm || null,
        doy: incoming.values.doy || null,
        email: incoming.values.email || null,
        phone_mobile: incoming.values.phone_mobile || null,
        phone_landline: incoming.values.phone_landline || null,
        address_street: incoming.values.address_street || null,
        address_city: incoming.values.address_city || null,
        address_postal_code: incoming.values.address_postal_code || null,
        assigned_agent_id: row.agentId ?? agencyUser.id,
        created_by: agencyUser.id,
      })
      .select("id")
      .single();
    if (error || !client) return null;

    await supabase
      .from("client_individuals")
      .insert({ client_id: client.id, first_name: firstName, last_name: lastName });

    stats.clientsCreated++;
    return client.id;
  }
}
