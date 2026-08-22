"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";
import { BulkActionsShell } from "@/components/bulk-actions-shell";

export function RemittanceBulkBar({
  action,
  successLabel,
  receiptKind,
}: {
  action: (movementIds: string[]) => Promise<{ error: string } | undefined>;
  successLabel: string;
  receiptKind: "premium" | "commission";
}) {
  const { clear } = useBulkSelection();
  const [isPending, startTransition] = useTransition();

  return (
    <BulkActionsShell>
      {(ids) => (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await action(ids);
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                // Το έντυπο ανοίγει ΠΡΙΝ το clear(): μετά τον καθαρισμό της
                // επιλογής τα id δεν υπάρχουν πουθενά για να τυπωθούν.
                window.open(
                  `/dashboard/remittances/receipt?kind=${receiptKind}&ids=${ids.join(",")}`,
                  "_blank",
                );
                toast.success(`${successLabel} (${ids.length}).`);
                clear();
              } catch {
                toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
              }
            })
          }
        >
          Απόδοση επιλεγμένων
        </Button>
      )}
    </BulkActionsShell>
  );
}
