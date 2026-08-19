"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/components/bulk-selection";

// Shared shell for every list page's "N selected" sticky bar — the count,
// export-selected link, and cancel button are identical everywhere;
// `children` renders whatever action is specific to that list (a status
// dropdown, a destructive button, ...).
export function BulkActionsShell({
  exportBasePath,
  children,
}: {
  exportBasePath?: string;
  children: (ids: string[]) => ReactNode;
}) {
  const { selected, clear } = useBulkSelection();

  if (selected.size === 0) return null;

  const ids = Array.from(selected);

  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
      <span className="text-sm text-muted-foreground">Επιλέχθηκαν {ids.length}</span>
      <div className="flex items-center gap-2">
        {children(ids)}
        {exportBasePath && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`${exportBasePath}?ids=${ids.join(",")}`}>Εξαγωγή επιλεγμένων</a>}
          />
        )}
        <Button variant="ghost" size="sm" onClick={clear}>
          Ακύρωση
        </Button>
      </div>
    </div>
  );
}
