"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkSelection } from "@/components/bulk-selection";

export function BulkStatusBar({
  statusOptions,
  applyAction,
  exportBasePath,
}: {
  statusOptions: { value: string; label: string }[];
  applyAction: (ids: string[], status: string) => Promise<void>;
  exportBasePath: string;
}) {
  const { selected, clear } = useBulkSelection();
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  if (selected.size === 0) return null;

  const ids = Array.from(selected);

  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
      <span className="text-sm text-muted-foreground">Επιλέχθηκαν {ids.length}</span>
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>
              {(v: string) => statusOptions.find((o) => o.value === v)?.label ?? "Αλλαγή κατάστασης..."}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={isPending || !status}
          onClick={() =>
            startTransition(async () => {
              await applyAction(ids, status);
              toast.success(`Ενημερώθηκε η κατάσταση για ${ids.length} εγγραφές.`);
              setStatus("");
              clear();
            })
          }
        >
          Εφαρμογή
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`${exportBasePath}?ids=${ids.join(",")}`}>Εξαγωγή επιλεγμένων</a>}
        />
        <Button variant="ghost" size="sm" onClick={clear}>
          Ακύρωση
        </Button>
      </div>
    </div>
  );
}
