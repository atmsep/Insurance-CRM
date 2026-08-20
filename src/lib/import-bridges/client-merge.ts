// Πώς φέρεται ένα import στα ΥΠΑΡΧΟΝΤΑ στοιχεία ενός πελάτη.
//
// Κανόνας του γραφείου: ένα αρχείο εταιρείας ΔΕΝ αντικαθιστά ποτέ στοιχείο
// που έχει ήδη καταχωρηθεί. Το τηλέφωνο που έχει η καρτέλα το έβαλε
// άνθρωπος και συχνά είναι το σωστό, ενώ το αρχείο κουβαλά ό,τι είχε
// δηλωθεί στην εταιρεία χρόνια πριν.
//
// Άρα:
//   - κενό πεδίο  -> συμπληρώνεται (δεν χάνεται τίποτα)
//   - ίδιο πεδίο  -> τίποτα
//   - ΔΙΑΦΟΡΕΤΙΚΟ -> η καρτέλα μένει ως έχει και η διαφορά γράφεται στις
//                    σημειώσεις, με ημερομηνία και πηγή, για να τη δει
//                    άνθρωπος και να αποφασίσει.

import { normalizeGreekPhone } from "@/lib/phone";

export type ClientFieldKey =
  | "phone_mobile"
  | "phone_landline"
  | "email"
  | "afm"
  | "doy"
  | "address_street"
  | "address_city"
  | "address_postal_code";

export const CLIENT_FIELD_LABELS: Record<ClientFieldKey, string> = {
  phone_mobile: "Κινητό",
  phone_landline: "Σταθερό",
  email: "Email",
  afm: "ΑΦΜ",
  doy: "ΔΟΥ",
  address_street: "Διεύθυνση",
  address_city: "Πόλη",
  address_postal_code: "Τ.Κ.",
};

export type ClientValues = Partial<Record<ClientFieldKey, string | null>>;

export type ClientMergePlan = {
  /** Πεδία που ήταν κενά και συμπληρώνονται. */
  fill: Partial<Record<ClientFieldKey, string>>;
  /** Γραμμές που προστίθενται στις σημειώσεις για όσα διαφέρουν. */
  noteLines: string[];
  /** Τα πεδία που διέφεραν — για τη σύνοψη του import. */
  conflicts: ClientFieldKey[];
};

function plainText(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("el-GR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Σύγκριση ανά είδος πεδίου, ώστε να μη θεωρηθεί «διαφορά» κάτι που είναι
// το ίδιο γραμμένο αλλιώς. Χωρίς αυτό, μία εισαγωγή γεμίζει τις καρτέλες με
// δεκάδες σημειώσεις που δεν λένε τίποτα, και οι πραγματικές διαφορές —
// αυτές που θέλει να δει άνθρωπος — χάνονται μέσα στον θόρυβο.
function comparable(field: ClientFieldKey, value: string): string {
  const trimmed = value.trim();
  if (field === "phone_mobile" || field === "phone_landline") {
    // «+30», «0030», κενά και παύλες.
    return normalizeGreekPhone(trimmed);
  }
  if (field === "email") return trimmed.toLowerCase();
  // «176 72» = «17672».
  if (field === "afm" || field === "address_postal_code") return trimmed.replace(/\D/g, "");
  if (field === "address_street") {
    // Τα αρχεία γράφουν οδό ΚΑΙ αριθμό μαζί («ΠΕΤΡΑΣ 104»), ενώ η καρτέλα
    // κρατά τον αριθμό σε δικό της πεδίο. Χωρίς αυτό, σχεδόν κάθε πελάτης
    // θα έβγαζε ψεύτικη διαφορά διεύθυνσης.
    return plainText(trimmed).replace(/\s+\d+[Α-ΩA-Z]?$/u, "");
  }
  if (field === "doy") {
    // «Α ΑΘΗΝΩΝ» και «ΑΘΗΝΩΝ Α» είναι η ίδια ΔΟΥ.
    return plainText(trimmed).split(" ").sort().join(" ");
  }
  return plainText(trimmed);
}

// Ειδικά για την πόλη: το αρχείο συχνά προσθέτει νομό ή περιοχή
// («ΚΑΛΛΙΘΕΑ ΑΤΤΙΚΗ» έναντι «ΚΑΛΛΙΘΕΑ»). Όταν το ένα περιέχει ολόκληρο το
// άλλο, πρόκειται για την ίδια πόλη γραμμένη πιο αναλυτικά.
function sameValue(field: ClientFieldKey, existing: string, incoming: string): boolean {
  const a = comparable(field, existing);
  const b = comparable(field, incoming);
  if (a === b) return true;
  if (field === "address_city" && a && b) {
    const wordsA = a.split(" ");
    const wordsB = b.split(" ");
    return wordsA.every((w) => wordsB.includes(w)) || wordsB.every((w) => wordsA.includes(w));
  }
  return false;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function planClientMerge(
  existing: ClientValues,
  incoming: ClientValues,
  context: { sourceName: string; date: string },
): ClientMergePlan {
  const fill: Partial<Record<ClientFieldKey, string>> = {};
  const noteLines: string[] = [];
  const conflicts: ClientFieldKey[] = [];
  const stamp = `[Εισαγωγή ${formatDate(context.date)} — ${context.sourceName}]`;

  for (const key of Object.keys(CLIENT_FIELD_LABELS) as ClientFieldKey[]) {
    const incomingRaw = (incoming[key] ?? "").trim();
    if (!incomingRaw) continue;

    const existingRaw = (existing[key] ?? "").trim();
    if (!existingRaw) {
      fill[key] = incomingRaw;
      continue;
    }

    if (sameValue(key, existingRaw, incomingRaw)) continue;

    conflicts.push(key);
    noteLines.push(
      `${stamp} ${CLIENT_FIELD_LABELS[key]} στο αρχείο: ${incomingRaw} — στην καρτέλα παραμένει: ${existingRaw}`,
    );
  }

  return { fill, noteLines, conflicts };
}

/**
 * Προσθέτει τις γραμμές στο τέλος των σημειώσεων, χωρίς να σβήνει τίποτα
 * και χωρίς να ξαναγράφει γραμμή που υπάρχει ήδη αυτούσια (ένα import που
 * τρέχει δεύτερη φορά δεν πρέπει να διπλασιάζει τις σημειώσεις).
 */
export function appendNotes(existingNotes: string | null, lines: string[]): string | null {
  if (!lines.length) return existingNotes;
  const current = existingNotes ?? "";
  const already = new Set(current.split("\n").map((l) => l.trim()));
  const fresh = lines.filter((l) => !already.has(l.trim()));
  if (!fresh.length) return existingNotes;
  return current ? `${current}\n${fresh.join("\n")}` : fresh.join("\n");
}
