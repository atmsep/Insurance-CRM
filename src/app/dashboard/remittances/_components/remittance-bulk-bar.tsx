"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";
import { BulkActionsShell } from "@/components/bulk-actions-shell";
import { openReceiptWindowDeferred } from "./open-receipt";

export function RemittanceBulkBar({
  action,
  successLabel,
  receiptKind,
  amountById,
}: {
  action: (movementIds: string[]) => Promise<{ error: string } | undefined>;
  successLabel: string;
  receiptKind: "premium" | "commission";
  amountById: Record<string, number>;
}) {
  const { clear } = useBulkSelection();
  const [isPending, startTransition] = useTransition();

  return (
    <BulkActionsShell>
      {(ids) => (
        <>
          {/* Το ποσό που θα παραδοθεί, ΠΡΙΝ πατηθεί η απόδοση. */}
          <span className="mr-1 text-sm">
            <span className="text-muted-foreground">Σύνολο: </span>
            <span className="font-semibold tabular-nums">
              {ids.reduce((sum, id) => sum + (amountById[id] ?? 0), 0).toFixed(2)} €
            </span>
          </span>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              const receipt = openReceiptWindowDeferred();
              startTransition(async () => {
                try {
                  const result = await action(ids);
                  if (result?.error) {
                    receipt.abort();
                    toast.error(result.error);
                    return;
                  }
                  // Το έντυπο γεμίζει ΠΡΙΝ το clear(): μετά τον καθαρισμό της
                  // επιλογής τα id δεν υπάρχουν πουθενά για να τυπωθούν.
                  receipt.fill(`/remittance-receipt?kind=${receiptKind}&ids=${ids.join(",")}`);
                  toast.success(`${successLabel} (${ids.length}).`);
                  clear();
                } catch {
                  receipt.abort();
                  toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
                }
              });
            }}
          >
            Απόδοση επιλεγμένων
          </Button>
        </>
      )}
    </BulkActionsShell>
  );
}
