import type { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

// Batch resolver for "Προμήθεια Συνεργάτη" (the agent's outgoing commission
// per production_entries row) — shared by page.tsx and export/route.ts so
// the logic never drifts between the two, same principle as filters.ts.
//
// production_entries (migration 0089) unions real policy_movements rows
// with synthetic rows for legacy `policies` terms that predate the
// movements table — a row's `id` is a real policy_movements.id when
// isReal, otherwise it's the term's own policies.id. Only real entries get
// a commission looked up here: mirrors getMovementReceipt/
// getFirstInstallmentId in ../../policies/movements-actions.ts — a
// commission attaches to the movement's FIRST installment (by
// installment_number) for every kind except cancellation, which gets no
// installments at all (it's a refund, not a receivable — see migration
// 0084) and instead attaches directly via commissions.policy_movement_id
// (migration 0087).
//
// Legacy (pre-ledger) commissions were never per-movement to begin with —
// confirmed empirically (see migration 0089's own verification): every
// commissions row for a legacy policy sets policy_id directly and leaves
// policy_installment_id null, often as several recurring period-based rows
// per policy (one Interlife policy has 72) rather than one lump sum per
// term. There's no single figure that honestly represents "the commission
// for this one synthesized row" — same conclusion the per-policy Κινήσεις
// tab already reached (synthesizeTermMovement in movements-actions.ts
// doesn't surface a commission for synthetic rows either) — so synthetic
// entries are left out of the lookup entirely and just show "—".
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const CHUNK_SIZE = 300;

export type ProductionEntryRef = { id: string; isReal: boolean };

export async function getOutgoingCommissionsByMovement(
  supabase: SupabaseAdminClient,
  entries: ProductionEntryRef[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const realIds = entries.filter((e) => e.isReal).map((e) => e.id);
  if (!realIds.length) return result;

  // 1. Batch-resolve each real movement's first installment (movements with
  // no installments at all — cancellations — simply never appear here).
  const firstInstallmentByMovement = new Map<string, string>();
  const installmentToMovement = new Map<string, string>();
  // Παράλληλα, όπως και τα δύο batches παρακάτω: σειριακά, με το πλήρες
  // ιστορικό του Profia μέσα, αυτό γινόταν δεκάδες διαδοχικά ερωτήματα και
  // κρατούσε τη σελίδα Αποδόσεων δεκάδες δευτερόλεπτα.
  const firstInstallmentBatches = await Promise.all(
    chunk(realIds, CHUNK_SIZE).map((idChunk) =>
      supabase
        .from("policy_installments")
        .select("id, movement_id, installment_number")
        .in("movement_id", idChunk)
        .order("installment_number", { ascending: true }),
    ),
  );
  for (const { data } of firstInstallmentBatches) {
    for (const row of (data ?? []) as { id: string; movement_id: string | null }[]) {
      if (!row.movement_id) continue;
      if (!firstInstallmentByMovement.has(row.movement_id)) {
        firstInstallmentByMovement.set(row.movement_id, row.id);
      }
      installmentToMovement.set(row.id, row.movement_id);
    }
  }
  const installmentIds = [...firstInstallmentByMovement.values()];

  // 2. Two parallel, chunked lookups against commissions: the
  // installment-attached path (every kind but cancellation) and the
  // movement-attached path (cancellations only).
  const [installmentBatches, movementBatches] = await Promise.all([
    Promise.all(
      chunk(installmentIds, CHUNK_SIZE).map((c) =>
        supabase
          .from("commissions")
          .select("policy_installment_id, commission_amount")
          .eq("direction", "outgoing")
          .in("policy_installment_id", c),
      ),
    ),
    Promise.all(
      chunk(realIds, CHUNK_SIZE).map((c) =>
        supabase
          .from("commissions")
          .select("policy_movement_id, commission_amount")
          .eq("direction", "outgoing")
          .in("policy_movement_id", c),
      ),
    ),
  ]);

  for (const { data } of installmentBatches) {
    for (const row of (data ?? []) as { policy_installment_id: string | null; commission_amount: number }[]) {
      const movementId = row.policy_installment_id && installmentToMovement.get(row.policy_installment_id);
      if (movementId) result.set(movementId, row.commission_amount);
    }
  }
  for (const { data } of movementBatches) {
    for (const row of (data ?? []) as { policy_movement_id: string | null; commission_amount: number }[]) {
      if (row.policy_movement_id) result.set(row.policy_movement_id, row.commission_amount);
    }
  }

  return result;
}
