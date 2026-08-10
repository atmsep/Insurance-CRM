"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";

export {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";

export function BulkActionsBar({
  deactivateAction,
  exportBasePath,
}: {
  deactivateAction: (ids: string[]) => Promise<void>;
  exportBasePath: string;
}) {
  const { selected, clear } = useBulkSelection();
  const [isPending, startTransition] = useTransition();

  if (selected.size === 0) return null;

  const ids = Array.from(selected);

  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
      <span className="text-sm text-muted-foreground">Επιλέχθηκαν {ids.length}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`${exportBasePath}?ids=${ids.join(",")}`}>Εξαγωγή επιλεγμένων</a>}
        />
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deactivateAction(ids);
              clear();
            })
          }
        >
          Απενεργοποίηση
        </Button>
        <Button variant="ghost" size="sm" onClick={clear}>
          Ακύρωση
        </Button>
      </div>
    </div>
  );
}
