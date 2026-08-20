// Αντιστοιχίσεις κωδικών: τα αρχεία των εταιρειών γράφουν «113» και «001»,
// όχι «Generali» και «Αυτοκίνητο». Εδώ βρίσκουμε ΠΟΙΟΙ κωδικοί εμφανίζονται
// στο αρχείο και σε ποια διάσταση ανήκουν, ώστε το UI να ζητήσει από τον
// χρήστη να τους αποδώσει μία φορά.
//
// Καθαρές συναρτήσεις, χωρίς βάση — όπως και το map.ts.

import type { FieldMapping } from "./map";

export type CodeDimension =
  | "carrier"
  | "insurance_line"
  | "movement_kind"
  | "agent"
  | "payment_method";

/** Ποιο χαρτογραφημένο πεδίο τροφοδοτεί ποια διάσταση κωδικών. */
export const DIMENSION_BY_FIELD: Record<string, CodeDimension> = {
  carrier_code: "carrier",
  insurance_line: "insurance_line",
  movement_kind: "movement_kind",
  agent_name: "agent",
  payment_method: "payment_method",
};

export const DIMENSION_LABELS: Record<CodeDimension, string> = {
  carrier: "Ασφαλιστικές εταιρείες",
  insurance_line: "Κλάδοι",
  movement_kind: "Είδη κίνησης",
  agent: "Συνεργάτες",
  payment_method: "Τρόποι πληρωμής",
};

export const DIMENSION_HINTS: Record<CodeDimension, string> = {
  carrier: "Κάθε κωδικός εταιρείας του αρχείου δείχνει σε μία δική σου εταιρεία.",
  insurance_line: "Κάθε κωδικός κλάδου δείχνει σε έναν δικό σου κλάδο.",
  movement_kind: "Νέο συμβόλαιο, ανανέωση, πρόσθετη πράξη ή ακύρωση.",
  agent: "Ο κωδικός συνεργάτη της πηγής δείχνει σε χρήστη του γραφείου.",
  payment_method: "Ο κωδικός τρόπου πληρωμής δείχνει σε δικό σου τρόπο πληρωμής.",
};

/** Οι τιμές που δέχεται το policy_movement_kind_enum, στα ελληνικά. */
export const MOVEMENT_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "policy", label: "Νέο συμβόλαιο" },
  { value: "renewal", label: "Ανανέωση" },
  { value: "endorsement", label: "Πρόσθετη πράξη" },
  { value: "cancellation", label: "Ακύρωση" },
];

export type FoundCode = {
  code: string;
  /** Σε πόσες γραμμές του δείγματος εμφανίστηκε. */
  count: number;
  /** Παραδείγματα γραμμών, για να καταλάβει ο χρήστης τι είναι ο κωδικός. */
  samples: string[];
};

export type CodeGroup = {
  dimension: CodeDimension;
  sourceColumn: string;
  codes: FoundCode[];
};

const MAX_CODES_PER_DIMENSION = 200;
const MAX_SAMPLES = 3;

function readCell(row: string[], headers: string[], m: FieldMapping): string {
  if (m.constantValue) return m.constantValue;
  if (m.sourceIndex != null) return (row[m.sourceIndex] ?? "").trim();
  if (m.sourceColumn) {
    const idx = headers.findIndex(
      (h) => h.trim().toLocaleLowerCase("el-GR") === m.sourceColumn!.trim().toLocaleLowerCase("el-GR"),
    );
    if (idx >= 0) return (row[idx] ?? "").trim();
  }
  return "";
}

/**
 * Μαζεύει τους διακριτούς κωδικούς ανά διάσταση από τις γραμμές του αρχείου.
 * Ως «δείγμα» χρησιμοποιεί τον αριθμό συμβολαίου της γραμμής, γιατί αυτό
 * αναγνωρίζει ο χρήστης.
 */
export function collectCodes(
  headers: string[],
  rows: string[][],
  mappings: FieldMapping[],
): CodeGroup[] {
  const policyMapping = mappings.find((m) => m.targetField === "policy_number");
  const groups: CodeGroup[] = [];

  for (const m of mappings) {
    const dimension = DIMENSION_BY_FIELD[m.targetField];
    if (!dimension) continue;
    // Σταθερή τιμή δεν χρειάζεται αντιστοίχιση ανά γραμμή — είναι ήδη μία.
    if (!m.sourceColumn && m.sourceIndex == null) continue;

    const found = new Map<string, FoundCode>();
    for (const row of rows) {
      const code = readCell(row, headers, m);
      if (!code) continue;
      let entry = found.get(code);
      if (!entry) {
        if (found.size >= MAX_CODES_PER_DIMENSION) continue;
        entry = { code, count: 0, samples: [] };
        found.set(code, entry);
      }
      entry.count++;
      if (entry.samples.length < MAX_SAMPLES && policyMapping) {
        const sample = readCell(row, headers, policyMapping);
        if (sample && !entry.samples.includes(sample)) entry.samples.push(sample);
      }
    }

    if (found.size === 0) continue;
    groups.push({
      dimension,
      sourceColumn: m.sourceColumn ?? `Στήλη ${(m.sourceIndex ?? 0) + 1}`,
      // Οι πιο συχνοί πρώτοι — αυτούς αξίζει να λύσει πρώτα ο χρήστης.
      codes: [...found.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, "el")),
    });
  }

  return groups;
}
