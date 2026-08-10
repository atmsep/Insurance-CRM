"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { REFERRAL_REWARD_CALC_TYPE_LABELS } from "../../referral-labels";

export function DefaultRewardRuleDialog({
  currentRule,
  applyAction,
}: {
  currentRule: { calc_type: "percent" | "fixed"; rate_percent: number | null; fixed_amount: number | null } | null;
  applyAction: (formData: FormData) => Promise<{ error: string } | { count: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [calcType, setCalcType] = useState<"percent" | "fixed">(currentRule?.calc_type ?? "percent");
  const [ratePercent, setRatePercent] = useState(currentRule?.rate_percent?.toString() ?? "");
  const [fixedAmount, setFixedAmount] = useState(currentRule?.fixed_amount?.toString() ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Γενικός κανόνας προμήθειας
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Γενικός κανόνας προμήθειας για τον πελάτη</DialogTitle>
          <DialogDescription>
            Ισχύει μόνο για τις συστάσεις αυτού του πελάτη. Εφαρμόζεται αυτόματα σε κάθε δικό του
            συμβόλαιο σύστασης που δεν έχει ήδη χειροκίνητο κανόνα — όσα έχεις ρυθμίσει μεμονωμένα δεν
            αλλάζουν. Μπορείς να το τρέξεις ξανά όποτε προστεθεί νέο συμβόλαιο.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            setIsSaving(true);
            const result = await applyAction(formData);
            setIsSaving(false);
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success(
              result.count > 0
                ? `Εφαρμόστηκε σε ${result.count} συμβόλαιο${result.count === 1 ? "" : "α"}.`
                : "Ο κανόνας αποθηκεύτηκε — δεν υπήρχαν συμβόλαια χωρίς χειροκίνητο κανόνα.",
            );
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={calcType === "percent" ? "default" : "outline"}
              onClick={() => setCalcType("percent")}
            >
              %
            </Button>
            <Button
              type="button"
              size="sm"
              variant={calcType === "fixed" ? "default" : "outline"}
              onClick={() => setCalcType("fixed")}
            >
              €
            </Button>
            <input type="hidden" name="calc_type" value={calcType} />
            <span className="text-xs text-muted-foreground">{REFERRAL_REWARD_CALC_TYPE_LABELS[calcType]}</span>
          </div>

          {calcType === "percent" ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Ποσοστό (%)</Label>
              <Input
                name="rate_percent"
                type="number"
                step="0.01"
                min="0"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="h-8 w-32"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Ποσό (€)</Label>
              <Input
                name="fixed_amount"
                type="number"
                step="0.01"
                min="0"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                className="h-8 w-32"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Εφαρμογή..." : "Εφαρμογή παντού"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
