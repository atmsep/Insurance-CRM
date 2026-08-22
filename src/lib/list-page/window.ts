import { athensToday, athensMonthsAgo } from "@/lib/date";

// ΓΕΝΙΚΟΣ ΚΑΝΟΝΑΣ ΑΠΟΔΟΣΗΣ — «παράθυρο, ένα ερώτημα, η βάση μετράει».
//
// Καμία σελίδα που διαβάζει πίνακα που μεγαλώνει (policy_movements,
// policy_installments, commissions, policies, installment_payments) δεν
// επιτρέπεται να εκτελέσει αφιλτράριστο ερώτημα. Μετρημένο στο production
// (43.557 κινήσεις): το production_entries_totals ΧΩΡΙΣ διάστημα σκάει σε
// statement timeout στα ~8,2 δευτ., ενώ με διάστημα ενός μήνα κάνει 384 ms.
// Το χειρότερο ήταν ότι το σφάλμα καταπινόταν και η σελίδα εμφάνιζε
// «Σύνολα: 0,00 €» πάνω από 43.685 γραμμές — λάθος νούμερο ως γεγονός.
//
// Δύο κανόνες που ΔΕΝ πρέπει να αναιρεθούν:
//
// 1. Το παράθυρο έχει ΠΡΟΕΠΙΛΟΓΗ, δεν είναι κενό. Κενή οθόνη «διάλεξε
//    διάστημα» είναι αδιέξοδο στο πρώτο άνοιγμα· ο χρήστης θέλει να δει
//    κάτι χρήσιμο αμέσως και να το διευρύνει μόνος του.
// 2. Το παράθυρο αφορά ΜΟΝΟ τι εμφανίζεται. Τα «αληθινά σύνολα» (π.χ. το
//    συνολικό ανείσπρακτο υπόλοιπο) υπολογίζονται πάντα ολόκληρα, από τη
//    βάση, και επισημαίνονται ρητά — αλλιώς ο κανόνας παράγει ψεύτικα
//    νούμερα, που είναι χειρότερα από αργή σελίδα.

export type DateWindow = {
  from: string;
  to: string;
  /** true όταν ο χρήστης όρισε ρητά το διάστημα — αλλιώς είναι η προεπιλογή. */
  explicit: boolean;
};

export type WindowPreset = "month" | "year";

const PRESET_MONTHS: Record<WindowPreset, number> = {
  // Κινήσεις/αποδόσεις: η δουλειά της ημέρας αφορά τον τρέχοντα μήνα.
  month: 1,
  // Ετήσιες αναφορές (ανανεωσιμότητα, παραγωγή ανά έτος).
  year: 12,
};

// Πάνω από αυτό η σελίδα το λέει καθαρά αντί να κολλήσει. Ίδια λογική με
// το MAX_PRINT_ROWS στο reports/production/print/page.tsx.
export const MAX_WINDOW_ROWS = 5000;

export function resolveWindow(
  from: string | undefined,
  to: string | undefined,
  preset: WindowPreset = "month",
): DateWindow {
  const explicit = Boolean(from || to);
  if (explicit) {
    // Μισό διάστημα είναι έγκυρο: «από 1/1» σημαίνει μέχρι σήμερα.
    return { from: from || athensMonthsAgo(PRESET_MONTHS[preset]), to: to || athensToday(), explicit: true };
  }
  return { from: athensMonthsAgo(PRESET_MONTHS[preset]), to: athensToday(), explicit: false };
}

// Περιγραφή του παραθύρου για την οθόνη, ώστε να μη νομίζει ποτέ ο χρήστης
// ότι βλέπει τα πάντα ενώ βλέπει έναν μήνα.
export function describeWindow(w: DateWindow): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
  return `${fmt(w.from)} — ${fmt(w.to)}`;
}
