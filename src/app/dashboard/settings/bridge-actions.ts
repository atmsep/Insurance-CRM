"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "./actions";
import { parseXlsx, parseCsv } from "@/lib/import-bridges/parse";
import { parseSlk, isSlk, isLegacyBinaryXls } from "@/lib/import-bridges/slk";
import { mapRows, suggestMappings, detectDecimalSeparator, type FieldMapping } from "@/lib/import-bridges/map";
import { isBridgeKind, type BridgeKind } from "@/lib/import-bridges/fields";

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
    };

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

  const mappings: FieldMapping[] =
    saved && saved.length
      ? saved.map((s) => ({
          targetField: s.target_field,
          sourceColumn: s.source_column,
          sourceIndex: s.source_index,
          transform: s.transform,
          constantValue: s.constant_value,
        }))
      : suggestMappings(sheet.headers, bridge.kind as BridgeKind);

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
  };
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
