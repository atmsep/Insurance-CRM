"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { installmentRemaining } from "../../policies/balance";

export type BulkCollectResult =
  | { error: string }
  | { collected: number; closed: number; amount: number; skipped: number };

const MAX_PER_RUN = 1000;

/**
 * Εισπράττει ΟΛΟΚΛΗΡΟ το υπόλοιπο κάθε επιλεγμένης δόσης.
 *
 * Σε αντίθεση με τη μεμονωμένη είσπραξη δεν υπάρχει μερική πληρωμή ούτε
 * σπάσιμο δόσης — μια μαζική ενέργεια που άφηνε υπόλοιπα δεν θα έκλεινε
 * ποτέ τη λίστα, που είναι όλος ο λόγος που υπάρχει.
 */
export async function bulkCollectInstallments(
  installmentIds: string[],
  options: { paidDate?: string; paymentMethodId?: string; receiptNumber?: string },
): Promise<BulkCollectResult> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Μόνο διαχειριστής μπορεί να κάνει μαζική είσπραξη." };
  }
  if (!installmentIds.length) return { error: "Δεν επιλέχθηκε καμία δόση." };
  if (installmentIds.length > MAX_PER_RUN) {
    return { error: `Πάρα πολλές δόσεις μαζί (${installmentIds.length}). Μέχρι ${MAX_PER_RUN} τη φορά.` };
  }

  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("policy_installments")
    .select("id, amount, paid_amount, status")
    .in("id", installmentIds);
  if (loadError) return { error: "Σφάλμα κατά την ανάγνωση των δόσεων: " + loadError.message };
  if (!rows?.length) return { error: "Δεν βρέθηκαν οι δόσεις." };

  // Η ημερομηνία μένει κενή = σήμερα. Δίνεται όμως επιλογή, γιατί μια
  // μαζική τακτοποίηση παλιών οφειλών με σημερινή ημερομηνία φουσκώνει το
  // Ταμείο της ημέρας με χρήματα που δεν μπήκαν σήμερα.
  const paidDate = options.paidDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());

  const toPay: { id: string; amount: number }[] = [];
  const toClose: string[] = [];
  for (const row of rows) {
    if (row.status === "paid" || row.status === "cancelled") continue;
    const remaining = installmentRemaining(row);
    if (remaining > 0) toPay.push({ id: row.id, amount: Math.round(remaining * 100) / 100 });
    // Υπόλοιπο μηδέν: ο έλεγχος της βάσης δεν δέχεται εγγραφή είσπραξης για
    // μηδενικό ποσό, οπότε η δόση απλώς κλείνει.
    else toClose.push(row.id);
  }

  const skipped = rows.length - toPay.length - toClose.length;

  // Αρίθμηση αποδείξεων: ένας κοινός αριθμός αν τον έδωσε ο χρήστης
  // (συγκεντρωτική απόδειξη), αλλιώς ξεχωριστός από την ακολουθία της βάσης.
  let numbers: (string | null)[] = [];
  if (options.receiptNumber) {
    numbers = toPay.map(() => options.receiptNumber!);
  } else {
    const results = await Promise.all(toPay.map(() => admin.rpc("next_receipt_number")));
    numbers = results.map((r) => (r.data != null ? String(r.data) : null));
  }

  if (toPay.length) {
    const { error } = await admin.from("installment_payments").insert(
      toPay.map((p, i) => ({
        installment_id: p.id,
        amount: p.amount,
        payment_method_id: options.paymentMethodId || null,
        receipt_number: numbers[i],
        paid_by: agencyUser.id,
        paid_date: paidDate,
        paid_at: new Date(`${paidDate}T12:00:00Z`).toISOString(),
      })),
    );
    if (error) return { error: "Σφάλμα κατά την καταχώρηση εισπράξεων: " + error.message };
  }

  if (toClose.length) {
    const { error } = await admin
      .from("policy_installments")
      .update({ status: "paid" })
      .in("id", toClose);
    if (error) return { error: "Σφάλμα κατά το κλείσιμο μηδενικών υπολοίπων: " + error.message };
  }

  const amount = Math.round(toPay.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  await logActivity(admin, {
    entityType: "policy_installment",
    entityId: toPay[0]?.id ?? toClose[0] ?? installmentIds[0],
    action: "bulk_collected",
    description: `Μαζική είσπραξη ${toPay.length} δόσεων (${amount.toFixed(2)} €) με ημερομηνία ${paidDate}.`,
    actorId: agencyUser.id,
  });

  revalidatePath("/dashboard/reports/receivables");
  revalidatePath("/dashboard/cash-register");
  return { collected: toPay.length, closed: toClose.length, amount, skipped };
}
