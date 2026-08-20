// Τι πεδία δέχεται κάθε είδος γέφυρας.
//
// Ελεύθερο κείμενο στη βάση (`import_bridge_fields.target_field`) ώστε νέο
// πεδίο να μη χρειάζεται migration — αυτός ο κατάλογος είναι η αυθεντία για
// το τι εμφανίζει το UI και τι καταλαβαίνει ο εισαγωγέας.

export type BridgeKind = "production" | "commissions" | "payments" | "expirations";

export const BRIDGE_KIND_LABELS: Record<BridgeKind, string> = {
  production: "Παραγωγή / Χαρτοφυλάκιο",
  commissions: "Εκκαθαρίσεις προμηθειών",
  payments: "Εισπράξεις ασφαλίστρων",
  expirations: "Ληξιάρια / Προς ανανέωση",
};

export const BRIDGE_KIND_DESCRIPTIONS: Record<BridgeKind, string> = {
  production:
    "Λίστα συμβολαίων (νέα, ανανεώσεις, ακυρώσεις) — ενημερώνει το χαρτοφυλάκιο και δημιουργεί κινήσεις.",
  commissions:
    "Τι δηλώνει η εταιρεία ότι σου οφείλει — συγκρίνεται με τις δικές σου εγγραφές προμηθειών.",
  payments:
    "Δόσεις που εισέπραξε απευθείας η εταιρεία — ώστε να μη φαίνονται ανείσπρακτες σε εσένα.",
  expirations:
    "Συμβόλαια που λήγουν — για προγραμματισμό ανανεώσεων.",
};

export type FieldType = "text" | "number" | "date" | "amount";

export type TargetField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
};

// Κοινά σε όλα τα είδη: ο αριθμός συμβολαίου είναι το κλειδί ταύτισης.
const POLICY_KEY: TargetField = {
  key: "policy_number",
  label: "Αριθμός συμβολαίου",
  type: "text",
  required: true,
  hint: "Το κλειδί με το οποίο ταιριάζει η γραμμή με το δικό σου συμβόλαιο.",
};

export const TARGET_FIELDS: Record<BridgeKind, TargetField[]> = {
  production: [
    POLICY_KEY,
    { key: "application_number", label: "Αριθμός αίτησης", type: "text" },
    { key: "movement_kind", label: "Είδος κίνησης", type: "text", hint: "π.χ. Νέο / Ανανέωση / Ακύρωση — αντιστοιχίζεται αυτόματα." },
    { key: "client_name", label: "Πελάτης (ονοματεπώνυμο)", type: "text" },
    { key: "client_afm", label: "ΑΦΜ πελάτη", type: "text", hint: "Αν υπάρχει, δίνει πολύ ασφαλέστερη ταύτιση από το όνομα." },
    { key: "client_phone", label: "Τηλέφωνο πελάτη", type: "text" },
    { key: "insurance_line", label: "Κλάδος", type: "text" },
    { key: "risk_label", label: "Χαρακτηριστικό (πινακίδα/διεύθυνση)", type: "text" },
    { key: "issue_date", label: "Ημ. έκδοσης", type: "date" },
    { key: "start_date", label: "Ημ. έναρξης", type: "date", required: true },
    { key: "end_date", label: "Ημ. λήξης", type: "date", required: true },
    { key: "premium_gross", label: "Μικτά ασφάλιστρα", type: "amount", required: true },
    { key: "premium_net", label: "Καθαρά ασφάλιστρα", type: "amount" },
    { key: "commission_rate", label: "Ποσοστό προμήθειας", type: "number" },
    { key: "commission_amount", label: "Ποσό προμήθειας", type: "amount" },
    { key: "agent_name", label: "Συνεργάτης", type: "text" },
  ],
  commissions: [
    POLICY_KEY,
    { key: "document_number", label: "Παραστατικό", type: "text" },
    { key: "period", label: "Περίοδος", type: "date", hint: "Ο μήνας/η ημερομηνία στην οποία αφορά η προμήθεια." },
    { key: "base_amount", label: "Βάση υπολογισμού (καθαρά)", type: "amount" },
    { key: "commission_rate", label: "Ποσοστό προμήθειας", type: "number" },
    { key: "commission_amount", label: "Ποσό προμήθειας", type: "amount", required: true },
    { key: "agent_name", label: "Συνεργάτης / δικαιούχος", type: "text" },
    { key: "movement_kind", label: "Είδος (νέα/ανανέωση/ακύρωση)", type: "text" },
  ],
  payments: [
    POLICY_KEY,
    { key: "installment_number", label: "Αριθμός δόσης", type: "number" },
    { key: "paid_date", label: "Ημ. είσπραξης", type: "date", required: true },
    { key: "amount", label: "Ποσό είσπραξης", type: "amount", required: true },
    { key: "receipt_number", label: "Αριθμός απόδειξης", type: "text" },
    { key: "payment_method", label: "Τρόπος πληρωμής", type: "text" },
  ],
  expirations: [
    POLICY_KEY,
    { key: "end_date", label: "Ημ. λήξης", type: "date", required: true },
    { key: "client_name", label: "Πελάτης", type: "text" },
    { key: "client_phone", label: "Τηλέφωνο πελάτη", type: "text" },
    { key: "insurance_line", label: "Κλάδος", type: "text" },
    { key: "risk_label", label: "Χαρακτηριστικό", type: "text" },
    { key: "premium_gross", label: "Μικτά ασφάλιστρα", type: "amount" },
  ],
};

// Μετασχηματισμοί που μπορεί να χρειαστεί μια στήλη πριν αποθηκευτεί.
export const TRANSFORMS: { key: string; label: string; appliesTo: FieldType[] }[] = [
  { key: "greek_plate", label: "Πινακίδα σε ελληνικούς χαρακτήρες", appliesTo: ["text"] },
  { key: "trim_leading_zeros", label: "Αφαίρεση μηδενικών από την αρχή", appliesTo: ["text"] },
  { key: "uppercase", label: "Κεφαλαία", appliesTo: ["text"] },
  { key: "digits_only", label: "Μόνο ψηφία", appliesTo: ["text"] },
  { key: "negate", label: "Αντιστροφή προσήμου", appliesTo: ["amount", "number"] },
  { key: "abs", label: "Απόλυτη τιμή", appliesTo: ["amount", "number"] },
];

export function fieldsFor(kind: BridgeKind): TargetField[] {
  return TARGET_FIELDS[kind] ?? [];
}

export function isBridgeKind(value: string): value is BridgeKind {
  return value in TARGET_FIELDS;
}
