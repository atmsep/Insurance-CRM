"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

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

export function useBulkSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useBulkSelection must be used inside BulkSelectionProvider");
  return ctx;
}

export function BulkSelectCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useBulkSelection();
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
  const { selected, toggleAll } = useBulkSelection();
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(ids)} aria-label="Επιλογή όλων" />;
}
