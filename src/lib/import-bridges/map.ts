// Εφαρμόζει τη χαρτογράφηση μιας γέφυρας πάνω στις γραμμές του αρχείου:
// από «στήλη Ε του Excel» σε «premium_gross = 245.80».
//
// Καθαρές συναρτήσεις, χωρίς πρόσβαση σε βάση — ώστε να δοκιμάζονται και να
// τρέχουν ίδια στην προεπισκόπηση και στην τελική εφαρμογή.

import { fieldsFor, type BridgeKind, type TargetField } from "./fields";

export type BridgeSettings = {
  kind: BridgeKind;
  dateFormat: string;
  decimalSeparator: string;
};

export type FieldMapping = {
  targetField: string;
  sourceColumn: string | null;
  sourceIndex: number | null;
  transform: string | null;
  constantValue: string | null;
};

export type MappedRow = {
  rowNumber: number;
  values: Record<string, string | number | null>;
  errors: string[];
  warnings: string[];
};

// Ελληνικά πληκτρολόγια/εξαγωγές γράφουν πινακίδες με λατινικά ομοιογράμματα.
const PLATE_LATIN_TO_GREEK: Record<string, string> = {
  A: "Α", B: "Β", E: "Ε", Z: "Ζ", H: "Η", I: "Ι", K: "Κ", M: "Μ",
  N: "Ν", O: "Ο", P: "Ρ", T: "Τ", Y: "Υ", X: "Χ",
};

function applyTransform(value: string, transform: string | null): string {
  if (!value || !transform) return value;
  switch (transform) {
    case "greek_plate":
      return value.replace(/[A-Za-z]/g, (ch) => PLATE_LATIN_TO_GREEK[ch.toUpperCase()] ?? ch);
    case "trim_leading_zeros":
      return value.replace(/^0+(?=\d)/, "");
    case "uppercase":
      return value.toLocaleUpperCase("el-GR");
    case "digits_only":
      return value.replace(/\D/g, "");
    default:
      return value;
  }
}

function applyNumericTransform(n: number, transform: string | null): number {
  if (transform === "negate") return -n;
  if (transform === "abs") return Math.abs(n);
  return n;
}

// Δέχεται 1.234,56 / 1,234.56 / 1234.56 ανάλογα με το τι δήλωσε η γέφυρα,
// και τα λογιστικά αρνητικά σε παρενθέσεις: (245,80) = -245,80.
export function parseAmount(raw: string, decimalSeparator: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[€\s]/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  const thousands = decimalSeparator === "," ? "." : ",";
  s = s.split(thousands).join("");
  if (decimalSeparator === ",") s = s.replace(",", ".");
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// Δέχεται τη μορφή που δήλωσε η γέφυρα, αλλά και ISO (το Excel δίνει ήδη
// ISO για πραγματικά κελιά ημερομηνίας — βλ. parse.ts).
export function parseDate(raw: string, format: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const sep = format.includes("/") ? "/" : format.includes("-") ? "-" : ".";
  const parts = s.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length < 3) return null;
  const order = format.split(sep).map((p) => p.trim().toUpperCase());
  const idxDay = order.findIndex((p) => p.startsWith("D"));
  const idxMonth = order.findIndex((p) => p.startsWith("M"));
  const idxYear = order.findIndex((p) => p.startsWith("Y"));
  if (idxDay < 0 || idxMonth < 0 || idxYear < 0) return null;

  let year = Number(parts[idxYear]);
  const month = Number(parts[idxMonth]);
  const day = Number(parts[idxDay]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Απόρριψη ανύπαρκτων ημερομηνιών (π.χ. 31/02) — η Date τις «διορθώνει»
  // σιωπηλά, που θα έδινε λάθος δεδομένα χωρίς προειδοποίηση.
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return iso;
}

function resolveRaw(row: string[], headers: string[], m: FieldMapping): string {
  if (m.constantValue != null && m.constantValue !== "") return m.constantValue;
  if (m.sourceIndex != null) return row[m.sourceIndex] ?? "";
  if (m.sourceColumn) {
    const idx = headers.findIndex((h) => h.trim().toLocaleLowerCase("el-GR") === m.sourceColumn!.trim().toLocaleLowerCase("el-GR"));
    if (idx >= 0) return row[idx] ?? "";
  }
  return "";
}

export function mapRows(
  headers: string[],
  rows: string[][],
  mappings: FieldMapping[],
  settings: BridgeSettings,
  firstDataRowNumber: number,
): MappedRow[] {
  const targets = fieldsFor(settings.kind);
  const byKey = new Map<string, TargetField>(targets.map((t) => [t.key, t]));

  return rows.map((row, i) => {
    const values: Record<string, string | number | null> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const m of mappings) {
      const target = byKey.get(m.targetField);
      if (!target) continue;
      const raw = resolveRaw(row, headers, m);

      if (!raw) {
        values[target.key] = null;
        if (target.required) errors.push(`Λείπει: ${target.label}`);
        continue;
      }

      if (target.type === "amount" || target.type === "number") {
        const n = parseAmount(raw, settings.decimalSeparator);
        if (n === null) {
          errors.push(`${target.label}: δεν διαβάζεται ως αριθμός («${raw}»)`);
          values[target.key] = null;
        } else {
          values[target.key] = applyNumericTransform(n, m.transform);
        }
        continue;
      }

      if (target.type === "date") {
        const d = parseDate(raw, settings.dateFormat);
        if (!d) {
          errors.push(`${target.label}: δεν διαβάζεται ως ημερομηνία («${raw}»)`);
          values[target.key] = null;
        } else {
          values[target.key] = d;
        }
        continue;
      }

      values[target.key] = applyTransform(raw, m.transform);
    }

    // Πεδία υποχρεωτικά που δεν χαρτογραφήθηκαν καθόλου.
    for (const t of targets) {
      if (t.required && !(t.key in values)) errors.push(`Δεν έχει χαρτογραφηθεί: ${t.label}`);
    }

    // Σύγκριση σε απόλυτες τιμές: σε ακύρωση και τα δύο είναι αρνητικά, οπότε
    // το -256,40 είναι αριθμητικά «μεγαλύτερο» από το -320,50 χωρίς να
    // σημαίνει τίποτα κακό.
    if (settings.kind === "production" && values.premium_gross != null && values.premium_net != null) {
      if (Math.abs(Number(values.premium_net)) > Math.abs(Number(values.premium_gross))) {
        warnings.push("Τα καθαρά είναι μεγαλύτερα από τα μικτά — έλεγξε τη χαρτογράφηση.");
      }
    }
    if (values.start_date && values.end_date && String(values.end_date) < String(values.start_date)) {
      warnings.push("Η λήξη προηγείται της έναρξης.");
    }

    return { rowNumber: firstDataRowNumber + i, values, errors, warnings };
  });
}

// Προτείνει αυτόματα αντιστοιχίσεις συγκρίνοντας τους τίτλους του αρχείου με
// τα ονόματα των πεδίων — γλιτώνει τον χρήστη από το να τα βάλει όλα με το
// χέρι την πρώτη φορά.
const SYNONYMS: Record<string, string[]> = {
  policy_number: ["αρ. συμβολαιου", "αριθμος συμβολαιου", "συμβολαιο", "policy", "policy no", "αρ συμβ", "συμβόλαιο"],
  application_number: ["αιτηση", "αρ. αιτησης", "application"],
  client_name: ["πελατης", "ονοματεπωνυμο", "επωνυμια", "ασφαλισμενος", "client", "name"],
  client_afm: ["αφμ", "α.φ.μ.", "vat", "tin"],
  client_phone: ["τηλεφωνο", "κινητο", "phone", "τηλ"],
  insurance_line: ["κλαδος", "line", "ειδος ασφαλισης"],
  risk_label: ["πινακιδα", "αριθμος κυκλοφοριας", "διευθυνση", "χαρακτηριστικο", "plate"],
  issue_date: ["ημ. εκδοσης", "ημερομηνια εκδοσης", "εκδοση", "issue date"],
  start_date: ["εναρξη", "ημ. εναρξης", "απο", "start", "from"],
  end_date: ["ληξη", "ημ. ληξης", "εως", "end", "to", "expiry"],
  premium_gross: ["μικτα", "μικτο ασφαλιστρο", "συνολο ασφαλιστρων", "gross", "total premium", "πληρωτεο"],
  premium_net: ["καθαρα", "καθαρο ασφαλιστρο", "net"],
  commission_rate: ["ποσοστο", "ποσοστο προμηθειας", "rate", "%"],
  commission_amount: ["προμηθεια", "ποσο προμηθειας", "commission", "αμοιβη"],
  agent_name: ["συνεργατης", "πρακτορας", "agent", "διαμεσολαβητης"],
  movement_kind: ["ειδος", "ειδος κινησης", "τυπος", "kind", "type"],
  document_number: ["παραστατικο", "αρ. παραστατικου", "document"],
  period: ["περιοδος", "μηνας", "period"],
  base_amount: ["βαση", "βαση υπολογισμου", "base"],
  installment_number: ["δοση", "αρ. δοσης", "installment"],
  paid_date: ["ημ. εισπραξης", "ημερομηνια πληρωμης", "εξοφληση", "paid", "payment date"],
  amount: ["ποσο", "ποσο εισπραξης", "amount"],
  receipt_number: ["αποδειξη", "αρ. αποδειξης", "receipt"],
  payment_method: ["τροπος πληρωμης", "μεθοδος", "payment method"],
};

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // τόνοι
    .replace(/[^\p{L}\p{N} .]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Βαθμολογία ταιριάσματος τίτλου-στήλης με πεδίο. Η κατεύθυνση μετράει:
// τίτλος «Προμήθεια» ΔΕΝ πρέπει να πάει στο «Ποσοστό προμήθειας» μόνο και
// μόνο επειδή η φράση του πεδίου τον περιέχει (πραγματικό λάθος που
// εντοπίστηκε σε δοκιμή) — προτιμάται το πεδίο «Ποσό προμήθειας».
function scoreMatch(header: string, candidate: string): number {
  if (!header || !candidate) return 0;
  if (header === candidate) return 100;
  if (header.includes(candidate)) return 60 + candidate.length; // ο τίτλος περιέχει τον όρο
  if (candidate.includes(header)) return 30 + header.length;    // ασθενέστερο
  return 0;
}

export function suggestMappings(headers: string[], kind: BridgeKind): FieldMapping[] {
  const targets = fieldsFor(kind);

  // Όλα τα ζεύγη (πεδίο, στήλη) με βαθμό, ταξινομημένα — έτσι το καλύτερο
  // ταίριασμα κερδίζει ανεξάρτητα από τη σειρά των πεδίων στον κατάλογο.
  type Pair = { targetIdx: number; headerIdx: number; score: number };
  const pairs: Pair[] = [];
  targets.forEach((t, ti) => {
    const candidates = [normalize(t.label), ...(SYNONYMS[t.key] ?? []).map(normalize)];
    headers.forEach((h, hi) => {
      const nh = normalize(h);
      if (!nh) return;
      let best = 0;
      for (const c of candidates) best = Math.max(best, scoreMatch(nh, c));
      if (best > 0) pairs.push({ targetIdx: ti, headerIdx: hi, score: best });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const usedHeaders = new Set<number>();
  const usedTargets = new Set<number>();
  const out: FieldMapping[] = [];
  const MIN_SCORE = 30;

  for (const p of pairs) {
    if (p.score < MIN_SCORE) break;
    if (usedHeaders.has(p.headerIdx) || usedTargets.has(p.targetIdx)) continue;
    usedHeaders.add(p.headerIdx);
    usedTargets.add(p.targetIdx);
    const t = targets[p.targetIdx];
    out.push({
      targetField: t.key,
      sourceColumn: headers[p.headerIdx],
      sourceIndex: null,
      transform: t.key === "risk_label" ? "greek_plate" : null,
      constantValue: null,
    });
  }

  // Σταθερή σειρά εμφάνισης, όπως ο κατάλογος πεδίων.
  const order = new Map(targets.map((t, i) => [t.key, i]));
  return out.sort((a, b) => (order.get(a.targetField) ?? 0) - (order.get(b.targetField) ?? 0));
}
