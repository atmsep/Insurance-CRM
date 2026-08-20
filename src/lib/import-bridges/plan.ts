// Μετατρέπει τις χαρτογραφημένες γραμμές σε «σχέδιο εφαρμογής»: τι ακριβώς
// θα γίνει σε κάθε γραμμή, ΠΡΙΝ γραφτεί οτιδήποτε.
//
// Καθαρές συναρτήσεις, χωρίς βάση — ώστε η προεπισκόπηση και η πραγματική
// εφαρμογή να βγάζουν το ίδιο αποτέλεσμα, και να δοκιμάζονται χωριστά.
//
// ΘΕΜΕΛΙΩΔΗΣ ΚΑΝΟΝΑΣ: άγνωστος κωδικός ΔΕΝ περνά. Ούτε μαντεύεται, ούτε
// αγνοείται σιωπηλά — η γραμμή μπλοκάρεται και ο κωδικός εμφανίζεται στον
// χρήστη για αντιστοίχιση. Έτσι ένα νέο import από το ίδιο γραφείο, με μια
// εταιρεία που δεν είχε ξαναφανεί, σταματά και ρωτά αντί να καταχωρήσει
// συμβόλαια σε λάθος εταιρεία.

import type { MappedRow } from "./map";
import type { CodeDimension } from "./codes";

export type CodeResolution =
  | { kind: "target"; value: string }
  | { kind: "ignored" };

/** dimension -> (κωδικός -> τι σημαίνει). Κενό = δεν έχει αντιστοιχιστεί. */
export type CodeIndex = Record<CodeDimension, Map<string, CodeResolution>>;

export function emptyCodeIndex(): CodeIndex {
  return {
    carrier: new Map(),
    insurance_line: new Map(),
    movement_kind: new Map(),
    agent: new Map(),
    payment_method: new Map(),
  };
}

export type UnknownCode = { dimension: CodeDimension; code: string; count: number };

export type PlannedRow = {
  rowNumber: number;
  status: "ready" | "blocked" | "ignored";
  /** Γιατί μπλοκαρίστηκε ή αγνοήθηκε. */
  reasons: string[];
  policyNumber: string | null;
  carrierId: string | null;
  insuranceLineId: string | null;
  movementKind: string | null;
  agentId: string | null;
  clientCode: string | null;
  values: Record<string, string | number | null>;
};

export type PlanResult = {
  rows: PlannedRow[];
  unknownCodes: UnknownCode[];
  counts: { ready: number; blocked: number; ignored: number };
};

const DIMENSION_NOUN: Record<CodeDimension, string> = {
  carrier: "εταιρείας",
  insurance_line: "κλάδου",
  movement_kind: "είδους κίνησης",
  agent: "συνεργάτη",
  payment_method: "τρόπου πληρωμής",
};

/** Ποιο χαρτογραφημένο πεδίο δίνει τον κωδικό κάθε διάστασης. */
const FIELD_FOR_DIMENSION: Record<CodeDimension, string> = {
  carrier: "carrier_code",
  insurance_line: "insurance_line",
  movement_kind: "movement_kind",
  agent: "agent_name",
  payment_method: "payment_method",
};

export function planRows(
  mapped: MappedRow[],
  codes: CodeIndex,
  options: {
    /** Η εταιρεία της ίδιας της γέφυρας, όταν το αρχείο δεν φέρνει κωδικό. */
    defaultCarrierId: string | null;
    /** Πότε μια διάσταση είναι απαραίτητη για να προχωρήσει η γραμμή. */
    requiredDimensions: CodeDimension[];
  },
): PlanResult {
  const unknown = new Map<string, UnknownCode>();
  const rows: PlannedRow[] = [];

  for (const row of mapped) {
    const reasons: string[] = [...row.errors];
    let ignored = false;

    const resolved: Partial<Record<CodeDimension, string | null>> = {};

    for (const dimension of Object.keys(FIELD_FOR_DIMENSION) as CodeDimension[]) {
      const field = FIELD_FOR_DIMENSION[dimension];
      const raw = row.values[field];
      const code = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!code) {
        resolved[dimension] = null;
        continue;
      }

      const hit = codes[dimension].get(code);
      if (!hit) {
        const key = `${dimension} ${code}`;
        const seen = unknown.get(key);
        if (seen) seen.count++;
        else unknown.set(key, { dimension, code, count: 1 });
        // Ακόμα κι αν δεν είναι «απαραίτητη» διάσταση, ο άγνωστος κωδικός
        // μπλοκάρει: αλλιώς θα έμπαινε κίνηση με λάθος/κενό στοιχείο.
        reasons.push(`Άγνωστος κωδικός ${DIMENSION_NOUN[dimension]}: «${code}»`);
        resolved[dimension] = null;
        continue;
      }
      if (hit.kind === "ignored") {
        ignored = true;
        reasons.push(`Ο κωδικός ${DIMENSION_NOUN[dimension]} «${code}» έχει οριστεί να αγνοείται.`);
        resolved[dimension] = null;
        continue;
      }
      resolved[dimension] = hit.value;
    }

    const carrierId = resolved.carrier ?? options.defaultCarrierId;
    for (const dimension of options.requiredDimensions) {
      const value = dimension === "carrier" ? carrierId : resolved[dimension];
      if (!value && !reasons.some((r) => r.includes(DIMENSION_NOUN[dimension]))) {
        reasons.push(`Λείπει ${DIMENSION_NOUN[dimension]}.`);
      }
    }

    const policyNumber =
      row.values.policy_number == null ? null : String(row.values.policy_number).trim() || null;

    // Το «αγνοείται» υπερισχύει: ο χρήστης το δήλωσε ρητά, δεν είναι σφάλμα.
    const status: PlannedRow["status"] = ignored ? "ignored" : reasons.length ? "blocked" : "ready";

    rows.push({
      rowNumber: row.rowNumber,
      status,
      reasons,
      policyNumber,
      carrierId: carrierId ?? null,
      insuranceLineId: resolved.insurance_line ?? null,
      movementKind: resolved.movement_kind ?? null,
      agentId: resolved.agent ?? null,
      clientCode:
        row.values.client_code == null ? null : String(row.values.client_code).trim() || null,
      values: row.values,
    });
  }

  return {
    rows,
    unknownCodes: [...unknown.values()].sort((a, b) => b.count - a.count),
    counts: {
      ready: rows.filter((r) => r.status === "ready").length,
      blocked: rows.filter((r) => r.status === "blocked").length,
      ignored: rows.filter((r) => r.status === "ignored").length,
    },
  };
}
