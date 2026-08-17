import type { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

// Batch resolver for "Προμήθεια Συνεργάτη" (the agent's outgoing commission
// per movement) — shared by page.tsx and export/route.ts so the logic
// never drifts between the two, same principle as filters.ts.
//
// Mirrors getMovementReceipt/getFirstInstallmentId in ../../policies/
// movements-actions.ts, batched across many movements instead of one:
// a commission attaches to the movement's FIRST installment (by
// installment_number) for every kind except cancellation, which gets no
// installments at all (it's a refund, not a receivable — see migration
// 0084) and instead attaches directly via commissions.policy_movement_id
// (migration 0087). Two separate .in() queries rather than one .or() —
// simpler, and avoids the empty-list edge case an .or() would need to
// special-case (an all-cancellation page has zero installment ids).
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const CHUNK_SIZE = 300;

export async function getOutgoingCommissionsByMovement(
  supabase: SupabaseAdminClient,
  movementIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!movementIds.length) return result;

  // 1. Batch-resolve each movement's first installment (movements with no
  // installments at all — cancellations — simply never appear here).
  const firstInstallmentByMovement = new Map<string, string>();
  const installmentToMovement = new Map<string, string>();
  for (const idChunk of chunk(movementIds, CHUNK_SIZE)) {
    const { data } = await supabase
      .from("policy_installments")
      .select("id, movement_id, installment_number")
      .in("movement_id", idChunk)
      .order("installment_number", { ascending: true });
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
      chunk(movementIds, CHUNK_SIZE).map((c) =>
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
