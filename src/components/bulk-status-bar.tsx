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
import { BulkActionsShell } from "@/components/bulk-actions-shell";

export function BulkStatusBar({
  statusOptions,
  applyAction,
  exportBasePath,
}: {
  statusOptions: { value: string; label: string }[];
  applyAction: (ids: string[], status: string) => Promise<{ error: string } | undefined>;
  exportBasePath: string;
}) {
  const { clear } = useBulkSelection();
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <BulkActionsShell exportBasePath={exportBasePath}>
      {(ids) => (
        <>
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
                try {
                  const result = await applyAction(ids, status);
                  if (result?.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`Ενημερώθηκε η κατάσταση για ${ids.length} εγγραφές.`);
                  setStatus("");
                  clear();
                } catch {
                  toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
                }
              })
            }
          >
            Εφαρμογή
          </Button>
        </>
      )}
    </BulkActionsShell>
  );
}
