"use client";

import { useEffect, useState } from "react";
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
import { formatDate } from "@/lib/date";
import { useFormValues } from "@/hooks/use-form-values";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../movement-labels";
import { createManualMovement } from "../../movements-actions";

const MANUAL_KINDS = ["endorsement", "cancellation"] as const;

export type CurrentTermInfo = {
  startDate: string;
  endDate: string;
  premiumNet: number | null;
  premiumGross: number;
};

const EMPTY_VALUES = {
  document_number: "",
  start_date: "",
  end_date: "",
  premium_net: "",
  premium_gross: "",
  description: "",
  notes: "",
};

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function NewMovementDialog({
  policyId,
  open,
  onOpenChange,
  onCreated,
  currentTerm,
}: {
  policyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  currentTerm: CurrentTermInfo | null;
}) {
  const [kind, setKind] = useState<string>("endorsement");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountsTouched, setAmountsTouched] = useState(false);
  // Λήξη defaults to the CURRENT term's own end date (an
  // endorsement/cancellation happens within this term, it doesn't extend
  // it) — a plain mount-time default, editable by hand from there. The
  // parent remounts this component fresh on every open (key prop), so this
  // initializer re-evaluates against the latest currentTerm each time
  // instead of needing a reset effect.
  const { field, values, setValue } = useFormValues({ ...EMPTY_VALUES, end_date: currentTerm?.endDate ?? "" });

  // Ακύρωση only: approximate the cancellation amount as a pro-rata share
  // of the current term's premium — the fraction of the term still
  // remaining from this movement's Έναρξη through to the term's own Λήξη.
  useEffect(() => {
    if (kind !== "cancellation" || amountsTouched || !currentTerm || !values.start_date) return;
    const totalDays = daysBetween(currentTerm.startDate, currentTerm.endDate);
    if (totalDays <= 0) return;
    const remainingDays = Math.min(Math.max(daysBetween(values.start_date, currentTerm.endDate), 0), totalDays);
    const fraction = remainingDays / totalDays;
    setValue("premium_gross", (Math.round(currentTerm.premiumGross * fraction * 100) / 100).toFixed(2));
    if (currentTerm.premiumNet != null) {
      setValue("premium_net", (Math.round(currentTerm.premiumNet * fraction * 100) / 100).toFixed(2));
    }
  }, [kind, values.start_date, currentTerm, amountsTouched, setValue]);

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
            <Input id="new-movement-document" name="document_number" {...field("document_number")} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-start">Έναρξη</Label>
              <Input id="new-movement-start" name="start_date" type="date" required {...field("start_date")} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-end">Λήξη</Label>
              <Input
                id="new-movement-end"
                name="end_date"
                type="date"
                required
                value={values.end_date}
                onChange={(e) => setValue("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-net">Καθαρά Ασφάλιστρα</Label>
              <Input
                id="new-movement-net"
                name="premium_net"
                type="number"
                step="0.01"
                value={values.premium_net}
                onChange={(e) => {
                  setAmountsTouched(true);
                  setValue("premium_net", e.target.value);
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="new-movement-gross">Μικτά Ασφάλιστρα</Label>
              <Input
                id="new-movement-gross"
                name="premium_gross"
                type="number"
                step="0.01"
                required
                value={values.premium_gross}
                onChange={(e) => {
                  setAmountsTouched(true);
                  setValue("premium_gross", e.target.value);
                }}
              />
            </div>
          </div>

          {kind === "cancellation" && currentTerm && (
            <p className="text-xs text-muted-foreground">
              Κατά προσέγγιση ποσό ακύρωσης βάσει των ημερών που απομένουν μέχρι τη λήξη του τρέχοντος συμβολαίου (
              {formatDate(currentTerm.endDate)}). Μπορείς να το αλλάξεις χειροκίνητα.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-movement-description">Περιγραφή</Label>
            <Input id="new-movement-description" name="description" {...field("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-movement-notes">Σχόλια</Label>
            <Input id="new-movement-notes" name="notes" {...field("notes")} />
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
