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

export type MovementSpan = {
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// The most recently created policy/renewal movement isn't necessarily the
// term actually in effect on a given date — a renewal can be created ahead
// of its own start date, so pick whichever term's span actually contains
// dateIso. Falls back to the latest term that's already started, or the
// earliest term if dateIso is before all of them.
function findTermForDate(terms: MovementSpan[], dateIso: string): MovementSpan | null {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const containing = sorted.find((t) => dateIso >= t.startDate && dateIso <= t.endDate);
  if (containing) return containing;
  const started = [...sorted].reverse().find((t) => t.startDate <= dateIso);
  return started ?? sorted[0];
}

export function NewMovementDialog({
  policyId,
  open,
  onOpenChange,
  onCreated,
  termMovements,
  endorsementMovements,
}: {
  policyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  termMovements: MovementSpan[];
  endorsementMovements: MovementSpan[];
}) {
  const [kind, setKind] = useState<string>("endorsement");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [amountsTouched, setAmountsTouched] = useState(false);
  // Λήξη starts out defaulting to whichever term is active TODAY, then
  // follows Έναρξη once typed (see the effect below) — editable by hand
  // from either point. The parent remounts this component fresh on every
  // open (key prop), so this initializer re-evaluates each time.
  const { field, values, setValue } = useFormValues({
    ...EMPTY_VALUES,
    end_date: findTermForDate(termMovements, todayIso())?.endDate ?? "",
  });

  // Λήξη follows whichever term actually contains Έναρξη — an
  // endorsement/cancellation happens WITHIN that term, it doesn't extend
  // it — unless the user overrides it by hand.
  useEffect(() => {
    if (endDateTouched || !values.start_date) return;
    const term = findTermForDate(termMovements, values.start_date);
    if (term) setValue("end_date", term.endDate);
  }, [values.start_date, termMovements, endDateTouched, setValue]);

  // Ακύρωση only: approximate the cancellation amount as a pro-rata share
  // of the relevant term's premium PLUS any endorsement premiums already
  // charged for that same term — the fraction of the term still remaining
  // from this movement's Έναρξη through to the term's own Λήξη.
  useEffect(() => {
    if (kind !== "cancellation" || amountsTouched || !values.start_date) return;
    const term = findTermForDate(termMovements, values.start_date);
    if (!term) return;
    const totalDays = daysBetween(term.startDate, term.endDate);
    if (totalDays <= 0) return;
    const remainingDays = Math.min(Math.max(daysBetween(values.start_date, term.endDate), 0), totalDays);
    const fraction = remainingDays / totalDays;

    const sameTermEndorsements = endorsementMovements.filter(
      (e) => e.startDate >= term.startDate && e.startDate <= term.endDate,
    );
    const baseGross = term.premiumGross + sameTermEndorsements.reduce((sum, e) => sum + e.premiumGross, 0);
    const netParts = [term.premiumNet, ...sameTermEndorsements.map((e) => e.premiumNet)];
    const baseNet = netParts.every((n) => n != null) ? netParts.reduce((sum, n) => sum + (n as number), 0) : null;

    setValue("premium_gross", (Math.round(baseGross * fraction * 100) / 100).toFixed(2));
    if (baseNet != null) {
      setValue("premium_net", (Math.round(baseNet * fraction * 100) / 100).toFixed(2));
    }
  }, [kind, values.start_date, termMovements, endorsementMovements, amountsTouched, setValue]);

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

  const activeTerm = findTermForDate(termMovements, values.start_date || todayIso());

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
                onChange={(e) => {
                  setEndDateTouched(true);
                  setValue("end_date", e.target.value);
                }}
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

          {kind === "cancellation" && activeTerm && (
            <p className="text-xs text-muted-foreground">
              Κατά προσέγγιση ποσό ακύρωσης βάσει των ημερών που απομένουν μέχρι τη λήξη του συμβολαίου (
              {formatDate(activeTerm.endDate)}), μαζί με τυχόν πρόσθετες πράξεις της ίδιας περιόδου. Μπορείς να το
              αλλάξεις χειροκίνητα.
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
