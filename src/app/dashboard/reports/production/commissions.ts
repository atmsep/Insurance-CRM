import type { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

// Batch resolver for "Προμήθεια Συνεργάτη" (the agent's outgoing commission
// per production_entries row) — shared by page.tsx and export/route.ts so
// the logic never drifts between the two, same principle as filters.ts.
//
// production_entries (migration 0089) unions real policy_movements rows
// with synthetic rows for legacy `policies` terms that predate the
// movements table — a row's `id` is a real policy_movements.id when
// isReal, otherwise it's the term's own policies.id. The two need different
// commission lookups:
//   - real: mirrors getMovementReceipt/getFirstInstallmentId in ../../
//     policies/movements-actions.ts — a commission attaches to the
//     movement's FIRST installment (by installment_number) for every kind
//     except cancellation, which gets no installments at all (it's a
//     refund, not a receivable — see migration 0084) and instead attaches
//     directly via commissions.policy_movement_id (migration 0087).
//   - synthetic: legacy installments were scoped by policy_id with
//     movement_id left null (they predate movement_id, migration 0079) —
//     same first-installment-by-installment_number rule, just scoped by
//     policy_id + movement_id is null instead of movement_id.
// Two separate .in() queries per path rather than .or() — simpler, and
// avoids the empty-list edge case an .or() would need to special-case.
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
  if (!entries.length) return result;

  const realIds = entries.filter((e) => e.isReal).map((e) => e.id);
  const syntheticIds = entries.filter((e) => !e.isReal).map((e) => e.id);

  // 1a. Real movements: first installment per movement_id.
  const firstInstallmentByEntry = new Map<string, string>();
  const installmentToEntry = new Map<string, string>();
  for (const idChunk of chunk(realIds, CHUNK_SIZE)) {
    const { data } = await supabase
      .from("policy_installments")
      .select("id, movement_id, installment_number")
      .in("movement_id", idChunk)
      .order("installment_number", { ascending: true });
    for (const row of (data ?? []) as { id: string; movement_id: string | null }[]) {
      if (!row.movement_id) continue;
      if (!firstInstallmentByEntry.has(row.movement_id)) {
        firstInstallmentByEntry.set(row.movement_id, row.id);
      }
      installmentToEntry.set(row.id, row.movement_id);
    }
  }

  // 1b. Synthetic (legacy) terms: first installment per policy_id, among
  // installments never linked to a movement.
  for (const idChunk of chunk(syntheticIds, CHUNK_SIZE)) {
    const { data } = await supabase
      .from("policy_installments")
      .select("id, policy_id, installment_number")
      .in("policy_id", idChunk)
      .is("movement_id", null)
      .order("installment_number", { ascending: true });
    for (const row of (data ?? []) as { id: string; policy_id: string }[]) {
      if (!firstInstallmentByEntry.has(row.policy_id)) {
        firstInstallmentByEntry.set(row.policy_id, row.id);
      }
      installmentToEntry.set(row.id, row.policy_id);
    }
  }
  const installmentIds = [...firstInstallmentByEntry.values()];

  // 2. Two parallel, chunked lookups against commissions: the
  // installment-attached path (every kind but cancellation, both real and
  // synthetic entries) and the movement-attached path (cancellations only,
  // which only real entries can be — synthetic rows never carry
  // commissions.policy_movement_id).
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
      const entryId = row.policy_installment_id && installmentToEntry.get(row.policy_installment_id);
      if (entryId) result.set(entryId, row.commission_amount);
    }
  }
  for (const { data } of movementBatches) {
    for (const row of (data ?? []) as { policy_movement_id: string | null; commission_amount: number }[]) {
      if (row.policy_movement_id) result.set(row.policy_movement_id, row.commission_amount);
    }
  }

  return result;
}
