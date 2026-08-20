"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "./actions";
import { parseXlsx, parseCsv } from "@/lib/import-bridges/parse";
import { parseSlk, isSlk, isLegacyBinaryXls } from "@/lib/import-bridges/slk";
import { mapRows, suggestMappings, detectDecimalSeparator, type FieldMapping } from "@/lib/import-bridges/map";
import { isBridgeKind, type BridgeKind } from "@/lib/import-bridges/fields";
import {
  collectCodes,
  MOVEMENT_KIND_OPTIONS,
  type CodeDimension,
} from "@/lib/import-bridges/codes";

export type BridgeActionState = { error: string } | { success: string } | undefined;

// Το πλήθος γραμμών που δείχνει η προεπισκόπηση. Το αρχείο διαβάζεται
// ολόκληρο (για να μετρηθούν σωστά σφάλματα/σύνολα) αλλά επιστρέφονται
// λίγες γραμμές, αλλιώς το payload προς τον browser γίνεται τεράστιο.
const PREVIEW_ROWS = 25;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export async function saveBridge(
  bridgeId: string | null,
  _prev: BridgeActionState,
  formData: FormData,
): Promise<BridgeActionState> {
  const agencyUser = await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = str(formData, "name");
  const kind = str(formData, "kind");
  const owner = str(formData, "owner"); // "carrier:<id>" ή "broker:<id>"
  if (!name) return { error: "Δώσε όνομα στη γέφυρα." };
  if (!kind || !isBridgeKind(kind)) return { error: "Επίλεξε είδος δεδομένων." };
  if (!owner) return { error: "Επίλεξε ασφαλιστική εταιρεία ή συνεργαζόμενο γραφείο." };

  const [ownerType, ownerId] = owner.split(":");
  const headerRow = Number(str(formData, "header_row") ?? "1");
  if (!Number.isInteger(headerRow) || headerRow < 1) {
    return { error: "Η γραμμή τίτλων πρέπει να είναι θετικός ακέραιος." };
  }

  const payload = {
    name,
    kind,
    carrier_id: ownerType === "carrier" ? ownerId : null,
    broker_office_id: ownerType === "broker" ? ownerId : null,
    file_format: str(formData, "file_format") ?? "xlsx",
    sheet_name: str(formData, "sheet_name"),
    header_row: headerRow,
    csv_delimiter: str(formData, "csv_delimiter"),
    date_format: str(formData, "date_format") ?? "DD/MM/YYYY",
    decimal_separator: str(formData, "decimal_separator") ?? ",",
    notes: str(formData, "notes"),
  };

  if (bridgeId) {
    const { error } = await supabase.from("import_bridges").update(payload).eq("id", bridgeId);
    if (error) return { error: mapDbError(error.message) };
  } else {
    const { error } = await supabase
      .from("import_bridges")
      .insert({ ...payload, created_by: agencyUser.id });
    if (error) return { error: mapDbError(error.message) };
  }

  revalidatePath("/dashboard/settings");
  return { success: "Η γέφυρα αποθηκεύτηκε." };
}

function mapDbError(message: string): string {
  if (message.includes("import_bridges_carrier_kind_idx") || message.includes("import_bridges_broker_kind_idx")) {
    return "Υπάρχει ήδη ενεργή γέφυρα ίδιου είδους για αυτή την εταιρεία/γραφείο.";
  }
  return "Σφάλμα: " + message;
}

export async function toggleBridgeActive(bridgeId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  await supabase.from("import_bridges").update({ is_active: isActive }).eq("id", bridgeId);
  revalidatePath("/dashboard/settings");
}

export async function deleteBridge(bridgeId: string): Promise<{ error: string } | undefined> {
  await requireAdmin();
  const supabase = await createSupabaseClient();
  const { count } = await supabase
    .from("import_runs")
    .select("id", { count: "exact", head: true })
    .eq("bridge_id", bridgeId)
    .eq("status", "applied");
  if ((count ?? 0) > 0) {
    return { error: "Η γέφυρα έχει εφαρμοσμένα imports — απενεργοποίησέ την αντί να τη διαγράψεις." };
  }
  const { error } = await supabase.from("import_bridges").delete().eq("id", bridgeId);
  if (error) return { error: "Σφάλμα κατά τη διαγραφή: " + error.message };
  revalidatePath("/dashboard/settings");
}

export type AnalyzeResult =
  | { error: string }
  | {
      headers: string[];
      sheetNames: string[];
      totalRows: number;
      blankRowsSkipped: number;
      suggested: FieldMapping[];
      preview: {
        rowNumber: number;
        values: Record<string, string | number | null>;
        errors: string[];
        warnings: string[];
      }[];
      rowsWithErrors: number;
      rowsWithWarnings: number;
      /** Ασυμφωνίες ανάμεσα στις ρυθμίσεις της γέφυρας και το ίδιο το αρχείο. */
      settingsNotices: string[];
      /** Οι κωδικοί που βρέθηκαν, με ό,τι έχει ήδη αντιστοιχιστεί. */
      codeGroups: ResolvedCodeGroup[];
      /** Οι διαθέσιμοι στόχοι ανά διάσταση, για τα dropdown του UI. */
      codeTargets: CodeTargets;
    };

export type ResolvedCodeGroup = {
  dimension: CodeDimension;
  sourceColumn: string;
  codes: {
    code: string;
    count: number;
    samples: string[];
    /** Το id/η τιμή που έχει ήδη αποθηκευτεί, ή "" αν δεν έχει λυθεί. */
    targetKey: string;
    isIgnored: boolean;
  }[];
};

export type CodeTargets = Record<CodeDimension, { value: string; label: string }[]>;

// Διαβάζει ένα δείγμα αρχείου και επιστρέφει τι βρήκε: στήλες, προτεινόμενη
// χαρτογράφηση και προεπισκόπηση με τα σφάλματα ανά γραμμή. ΔΕΝ γράφει
// τίποτα στα δεδομένα — είναι καθαρά βοήθημα ρύθμισης.
export async function analyzeSample(
  bridgeId: string,
  formData: FormData,
): Promise<AnalyzeResult> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Επίλεξε ένα αρχείο." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Το αρχείο ξεπερνά τα 15MB — στείλε μικρότερο δείγμα." };
  }

  const { data: bridge } = await supabase
    .from("import_bridges")
    .select("kind, file_format, sheet_name, header_row, csv_delimiter, date_format, decimal_separator")
    .eq("id", bridgeId)
    .maybeSingle();
  if (!bridge) return { error: "Δεν βρέθηκε η γέφυρα." };

  const lower = file.name.toLowerCase();
  // Η κατάληξη ΔΕΝ είναι αξιόπιστη: πολλά ελληνικά ασφαλιστικά προγράμματα
  // βγάζουν SYLK με όνομα .xls. Αποφασίζουμε από τα πρώτα bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isLegacyBinaryXls(bytes)) {
    return {
      error:
        "Το αρχείο είναι παλιό δυαδικό Excel (.xls) και δεν υποστηρίζεται. Άνοιξέ το στο Excel και αποθήκευσέ το ως .xlsx ή .csv.",
    };
  }

  let sheet;
  try {
    if (isSlk(bytes)) {
      sheet = parseSlk(bytes.buffer as ArrayBuffer, { headerRow: bridge.header_row });
    } else if (bridge.file_format === "csv" || lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const text = await file.text();
      sheet = parseCsv(text, { delimiter: bridge.csv_delimiter, headerRow: bridge.header_row });
    } else {
      sheet = await parseXlsx(bytes.buffer as ArrayBuffer, {
        sheetName: bridge.sheet_name,
        headerRow: bridge.header_row,
      });
    }
  } catch (e) {
    return { error: "Δεν ήταν δυνατή η ανάγνωση του αρχείου: " + (e instanceof Error ? e.message : String(e)) };
  }

  if (sheet.headers.length === 0) {
    return { error: "Δεν βρέθηκαν στήλες. Έλεγξε τη «Γραμμή τίτλων» και το φύλλο." };
  }

  // Αν η γέφυρα έχει ήδη αποθηκευμένη χαρτογράφηση, τη χρησιμοποιούμε ώστε
  // η προεπισκόπηση να δείχνει το πραγματικό αποτέλεσμα· αλλιώς προτείνουμε.
  const { data: saved } = await supabase
    .from("import_bridge_fields")
    .select("target_field, source_column, source_index, transform, constant_value")
    .eq("bridge_id", bridgeId);

  // Η φόρμα μπορεί να στείλει τις τρέχουσες (μη αποθηκευμένες ακόμα)
  // επιλογές του χρήστη, ώστε το «Ανανέωση προεπισκόπησης» να δείχνει το
  // αποτέλεσμα ΤΩΝ ΕΠΙΛΟΓΩΝ ΤΟΥ και όχι της παλιάς αποθηκευμένης εικόνας.
  const overrideRaw = formData.get("mappings");
  let override: FieldMapping[] | null = null;
  if (typeof overrideRaw === "string" && overrideRaw.trim()) {
    try {
      const parsed: unknown = JSON.parse(overrideRaw);
      if (Array.isArray(parsed)) override = parsed as FieldMapping[];
    } catch {
      // Άκυρο JSON: αγνοείται σιωπηλά, πέφτουμε στην αποθηκευμένη εικόνα.
    }
  }

  const mappings: FieldMapping[] =
    override ??
    (saved && saved.length
      ? saved.map((s) => ({
          targetField: s.target_field,
          sourceColumn: s.source_column,
          sourceIndex: s.source_index,
          transform: s.transform,
          constantValue: s.constant_value,
        }))
      : suggestMappings(sheet.headers, bridge.kind as BridgeKind));

  const mapped = mapRows(
    sheet.headers,
    sheet.rows,
    mappings,
    {
      kind: bridge.kind as BridgeKind,
      dateFormat: bridge.date_format,
      decimalSeparator: bridge.decimal_separator,
    },
    bridge.header_row + 1,
  );

  // Λάθος δεκαδικό χωριστικό δεν βγάζει σφάλμα — απλά κάνει τα ποσά
  // 100πλάσια. Το λέμε ρητά αντί να το αφήσουμε να φανεί έμμεσα.
  const settingsNotices: string[] = [];
  const detected = detectDecimalSeparator(sheet.headers, sheet.rows, mappings, bridge.kind as BridgeKind);
  if (detected && detected !== bridge.decimal_separator) {
    settingsNotices.push(
      `Το αρχείο γράφει τα ποσά με «${detected}» ως δεκαδικό, ενώ η γέφυρα είναι ρυθμισμένη σε «${bridge.decimal_separator}». Άλλαξέ το στις ρυθμίσεις της γέφυρας, αλλιώς τα ποσά θα διαβαστούν λάθος.`,
    );
  }

  const [codeGroups, codeTargets] = await Promise.all([
    resolveCodeGroups(bridgeId, sheet.headers, sheet.rows, mappings),
    loadCodeTargets(),
  ]);

  return {
    headers: sheet.headers,
    sheetNames: sheet.sheetNames,
    totalRows: sheet.rows.length,
    blankRowsSkipped: sheet.blankRowsSkipped,
    suggested: mappings,
    preview: mapped.slice(0, PREVIEW_ROWS),
    rowsWithErrors: mapped.filter((r) => r.errors.length > 0).length,
    rowsWithWarnings: mapped.filter((r) => r.warnings.length > 0).length,
    settingsNotices,
    codeGroups,
    codeTargets,
  };
}

// Το UI χειρίζεται κάθε στόχο ως ένα string "<είδος>:<id>" ώστε ένα και μόνο
// <select> να καλύπτει και τους πέντε τύπους αντιστοίχισης.
const IGNORE_KEY = "ignore";

function targetKeyOf(row: {
  carrier_id: string | null;
  insurance_line_id: string | null;
  agency_user_id: string | null;
  payment_method_id: string | null;
  target_value: string | null;
  is_ignored: boolean;
}): string {
  if (row.is_ignored) return IGNORE_KEY;
  if (row.carrier_id) return `carrier:${row.carrier_id}`;
  if (row.insurance_line_id) return `line:${row.insurance_line_id}`;
  if (row.agency_user_id) return `user:${row.agency_user_id}`;
  if (row.payment_method_id) return `method:${row.payment_method_id}`;
  if (row.target_value) return `value:${row.target_value}`;
  return "";
}

async function resolveCodeGroups(
  bridgeId: string,
  headers: string[],
  rows: string[][],
  mappings: FieldMapping[],
): Promise<ResolvedCodeGroup[]> {
  const groups = collectCodes(headers, rows, mappings);
  if (!groups.length) return [];

  const supabase = await createSupabaseClient();
  const { data: saved } = await supabase
    .from("import_bridge_code_maps")
    .select("dimension, source_code, carrier_id, insurance_line_id, agency_user_id, payment_method_id, target_value, is_ignored")
    .eq("bridge_id", bridgeId);

  const byKey = new Map((saved ?? []).map((s) => [`${s.dimension} ${s.source_code}`, s]));

  return groups.map((g) => ({
    dimension: g.dimension,
    sourceColumn: g.sourceColumn,
    codes: g.codes.map((c) => {
      const hit = byKey.get(`${g.dimension} ${c.code}`);
      return {
        code: c.code,
        count: c.count,
        samples: c.samples,
        targetKey: hit ? targetKeyOf(hit) : "",
        isIgnored: hit?.is_ignored ?? false,
      };
    }),
  }));
}

async function loadCodeTargets(): Promise<CodeTargets> {
  const supabase = await createSupabaseClient();
  const [{ data: carriers }, { data: lines }, { data: users }, { data: methods }] = await Promise.all([
    supabase.from("carriers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("insurance_lines").select("id, name_el").eq("is_active", true).order("sort_order"),
    supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  return {
    carrier: (carriers ?? []).map((c) => ({ value: `carrier:${c.id}`, label: c.name })),
    insurance_line: (lines ?? []).map((l) => ({ value: `line:${l.id}`, label: l.name_el })),
    agent: (users ?? []).map((u) => ({ value: `user:${u.id}`, label: u.full_name })),
    payment_method: (methods ?? []).map((m) => ({ value: `method:${m.id}`, label: m.name })),
    movement_kind: MOVEMENT_KIND_OPTIONS.map((o) => ({ value: `value:${o.value}`, label: o.label })),
  };
}

// Αποθηκεύει μία αντιστοίχιση κωδικού. Κενός στόχος = διαγραφή, ώστε ο
// χρήστης να μπορεί να αναιρέσει μια λάθος επιλογή.
export async function saveCodeMap(
  bridgeId: string,
  dimension: CodeDimension,
  sourceCode: string,
  targetKey: string,
): Promise<{ error: string } | { success: string }> {
  const agencyUser = await requireAdmin();
  const supabase = await createSupabaseClient();

  if (!targetKey) {
    const { error } = await supabase
      .from("import_bridge_code_maps")
      .delete()
      .eq("bridge_id", bridgeId)
      .eq("dimension", dimension)
      .eq("source_code", sourceCode);
    if (error) return { error: "Σφάλμα κατά τη διαγραφή: " + error.message };
    return { success: "Η αντιστοίχιση αφαιρέθηκε." };
  }

  const row = {
    bridge_id: bridgeId,
    dimension,
    source_code: sourceCode,
    carrier_id: null as string | null,
    insurance_line_id: null as string | null,
    agency_user_id: null as string | null,
    payment_method_id: null as string | null,
    target_value: null as string | null,
    is_ignored: false,
    created_by: agencyUser.id,
  };

  const [type, value] = targetKey.split(":");
  if (targetKey === IGNORE_KEY) row.is_ignored = true;
  else if (type === "carrier" && dimension === "carrier") row.carrier_id = value;
  else if (type === "line" && dimension === "insurance_line") row.insurance_line_id = value;
  else if (type === "user" && dimension === "agent") row.agency_user_id = value;
  else if (type === "method" && dimension === "payment_method") row.payment_method_id = value;
  else if (type === "value" && dimension === "movement_kind") row.target_value = value;
  else return { error: "Ο στόχος δεν ταιριάζει με το είδος του κωδικού." };

  const { error } = await supabase
    .from("import_bridge_code_maps")
    .upsert(row, { onConflict: "bridge_id,dimension,source_code" });
  if (error) return { error: "Σφάλμα κατά την αποθήκευση: " + error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Αποθηκεύτηκε." };
}

// Αποθηκεύει τη χαρτογράφηση. Αντικαθιστά ολόκληρη τη λίστα (delete+insert)
// αντί για ανά-πεδίο ενημέρωση: η φόρμα στέλνει πάντα την πλήρη εικόνα, και
// έτσι μια στήλη που αφαιρέθηκε δεν μένει ορφανή.
export async function saveBridgeMappings(
  bridgeId: string,
  mappings: FieldMapping[],
): Promise<{ error: string } | { success: string }> {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const clean = mappings.filter(
    (m) => m.targetField && (m.sourceColumn || m.sourceIndex != null || m.constantValue),
  );

  await supabase.from("import_bridge_fields").delete().eq("bridge_id", bridgeId);
  if (clean.length) {
    const { error } = await supabase.from("import_bridge_fields").insert(
      clean.map((m) => ({
        bridge_id: bridgeId,
        target_field: m.targetField,
        source_column: m.sourceColumn,
        source_index: m.sourceIndex,
        transform: m.transform,
        constant_value: m.constantValue,
      })),
    );
    if (error) return { error: "Σφάλμα κατά την αποθήκευση χαρτογράφησης: " + error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: `Αποθηκεύτηκε η χαρτογράφηση (${clean.length} πεδία).` };
}
