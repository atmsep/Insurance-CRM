"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";
import { BulkActionsShell } from "@/components/bulk-actions-shell";

export {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";

export function BulkActionsBar({
  deactivateAction,
  exportBasePath,
}: {
  deactivateAction: (ids: string[]) => Promise<{ error: string } | undefined>;
  exportBasePath: string;
}) {
  const { clear } = useBulkSelection();
  const [isPending, startTransition] = useTransition();

  return (
    <BulkActionsShell exportBasePath={exportBasePath}>
      {(ids) => (
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await deactivateAction(ids);
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`Απενεργοποιήθηκαν ${ids.length} πελάτες.`);
                clear();
              } catch {
                toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
              }
            })
          }
        >
          Απενεργοποίηση
        </Button>
      )}
    </BulkActionsShell>
  );
}
