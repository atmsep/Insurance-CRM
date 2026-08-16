"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../movement-labels";
import { createManualMovement } from "../../movements-actions";

const MANUAL_KINDS = ["endorsement", "cancellation"] as const;

export function NewMovementDialog({
  policyId,
  open,
  onOpenChange,
  onCreated,
}: {
  policyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [kind, setKind] = useState<string>("endorsement");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createManualMovement(policyId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onCreated?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέα Κίνηση</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Είδος</Label>
            <Select value={kind} onValueChange={(v) => setKind(v ?? "endorsement")}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => POLICY_MOVEMENT_KIND_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MANUAL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {POLICY_MOVEMENT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="kind" value={kind} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-movement-document">Παραστατικό</Label>
            <Input id="new-movement-document" name="document_number" />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-start">Έναρξη</Label>
              <Input id="new-movement-start" name="start_date" type="date" required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-end">Λήξη</Label>
              <Input id="new-movement-end" name="end_date" type="date" required />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-net">Καθαρά Ασφάλιστρα</Label>
              <Input id="new-movement-net" name="premium_net" type="number" step="0.01" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-gross">Μικτά Ασφάλιστρα</Label>
              <Input id="new-movement-gross" name="premium_gross" type="number" step="0.01" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-movement-description">Περιγραφή</Label>
            <Input id="new-movement-description" name="description" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-movement-notes">Σχόλια</Label>
            <Input id="new-movement-notes" name="notes" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Καταχώρηση..." : "Καταχώρηση"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
