"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";

// Ακύρωση είσπραξης — the ledger never deletes: the transaction row is
// marked reversed (who/when/why) and the DB trigger
// (recompute_installment_rollup, migration 0045) recomputes the δόση's
// paid_amount/status from the remaining active transactions, so the
// receivable reopens by itself. Admin-only, reason required — same policy
// as Profia's own ακύρωση απόδειξης. Uses the admin client for the write
// (the page reads the same way) with the role gate enforced here.
//
// Note: if this payment was a partial collection that auto-split its δόση
// (see collectInstallmentPayment), the split stays — the reopened δόση
// keeps its shrunk amount and the remainder δόση its own; an admin can
// merge amounts via Αλλαγή Δόσεων if needed.
export async function reverseInstallmentPayment(
  paymentId: string,
  reason: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    return { error: "Μόνο διαχειριστής μπορεί να ακυρώσει είσπραξη." };
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { error: "Η αιτιολογία ακύρωσης είναι υποχρεωτική." };
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("installment_payments")
    .select("id, amount, is_reversed, installment_id, policy_installments!inner(policy_id)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "Δεν βρέθηκε η είσπραξη." };
  if (payment.is_reversed) return { error: "Η είσπραξη είναι ήδη ακυρωμένη." };

  const { error } = await admin
    .from("installment_payments")
    .update({
      is_reversed: true,
      reversed_by: agencyUser.id,
      reversed_at: new Date().toISOString(),
      reversal_reason: trimmedReason,
    })
    .eq("id", paymentId)
    .eq("is_reversed", false);
  if (error) return { error: "Σφάλμα κατά την ακύρωση: " + error.message };

  const policyId = (
    payment.policy_installments as unknown as { policy_id: string } | { policy_id: string }[] | null
  );
  const resolvedPolicyId = Array.isArray(policyId) ? policyId[0]?.policy_id : policyId?.policy_id;

  if (resolvedPolicyId) {
    const supabase = await createSupabaseClient();
    await logActivity(supabase, {
      entityType: "policy",
      entityId: resolvedPolicyId,
      action: "payment_reversed",
      description: `Ακυρώθηκε είσπραξη ${payment.amount.toFixed(2)} € — ${trimmedReason}`,
      actorId: agencyUser.id,
    });
    revalidatePath(`/dashboard/policies/${resolvedPolicyId}`);
  }

  revalidatePath("/dashboard/cash-register");
  revalidatePath("/dashboard/remittances");
}
