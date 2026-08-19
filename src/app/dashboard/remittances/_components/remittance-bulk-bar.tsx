"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";
import { BulkActionsShell } from "@/components/bulk-actions-shell";

export function RemittanceBulkBar({
  action,
  successLabel,
}: {
  action: (movementIds: string[]) => Promise<{ error: string } | undefined>;
  successLabel: string;
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
