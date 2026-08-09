"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = useMemo<SelectionContextValue>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      toggleAll: (ids) =>
        setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids))),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside BulkSelectionProvider");
  return ctx;
}

export function BulkSelectCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSelection();
  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Επιλογή"
    />
  );
}

export function BulkSelectAllCheckbox({ ids }: { ids: string[] }) {
  const { selected, toggleAll } = useSelection();
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(ids)} aria-label="Επιλογή όλων" />;
}

export function BulkActionsBar({
  deactivateAction,
  exportBasePath,
}: {
  deactivateAction: (ids: string[]) => Promise<void>;
  exportBasePath: string;
}) {
  const { selected, clear } = useSelection();
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
