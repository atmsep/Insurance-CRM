"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { referralRewardStatusVariant } from "@/lib/status-badge";
import { REFERRAL_REWARD_STATUS_LABELS, REFERRAL_REWARD_CALC_TYPE_LABELS } from "../../referral-labels";

type Reward = {
  calc_type: "percent" | "fixed";
  rate_percent: number | null;
  fixed_amount: number | null;
  reward_amount: number;
  status: string;
  notes: string | null;
};

export function ReferralRewardForm({
  premiumNet,
  reward,
  rewardAction,
}: {
  premiumNet: number | null;
  reward: Reward | null;
  rewardAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [calcType, setCalcType] = useState<"percent" | "fixed">(reward?.calc_type ?? "percent");
  const [statusValue, setStatusValue] = useState(reward?.status ?? "pending");
  const [ratePercent, setRatePercent] = useState(reward?.rate_percent?.toString() ?? "");
  const [fixedAmount, setFixedAmount] = useState(reward?.fixed_amount?.toString() ?? "");

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        {reward ? (
          <>
            <span className="text-sm">{reward.reward_amount.toFixed(2)} €</span>
            <Badge variant={referralRewardStatusVariant(reward.status)}>
              {REFERRAL_REWARD_STATUS_LABELS[reward.status] ?? reward.status}
            </Badge>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Δεν έχει οριστεί κανόνας</span>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
          {reward ? "Επεξεργασία" : "Ορισμός κανόνα"}
        </Button>
      </div>
    );
  }

  const previewAmount =
    calcType === "percent"
      ? (premiumNet ?? 0) * (Number(ratePercent) || 0) / 100
      : Number(fixedAmount) || 0;

  return (
    <form
      action={async (formData) => {
        setIsSaving(true);
        const result = await rewardAction(formData);
        setIsSaving(false);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Η ανταπόδοση ενημερώθηκε.");
          setIsEditing(false);
        }
      }}
      className="flex flex-col gap-2 rounded-md border p-2"
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
        <span className="text-xs text-muted-foreground">
          {REFERRAL_REWARD_CALC_TYPE_LABELS[calcType]}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
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
              className="h-7 w-24 text-xs"
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
              className="h-7 w-24 text-xs"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Κατάσταση</Label>
          <Select value={statusValue} onValueChange={(v) => setStatusValue(v ?? "pending")}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue>{(v: string) => REFERRAL_REWARD_STATUS_LABELS[v] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REFERRAL_REWARD_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="status" value={statusValue} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Σημειώσεις</Label>
          <Input name="notes" defaultValue={reward?.notes ?? ""} className="h-7 w-36 text-xs" />
        </div>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          Άκυρο
        </Button>
      </div>

      {calcType === "percent" && premiumNet == null ? (
        <p className="text-xs text-warning">
          Το συμβόλαιο δεν έχει καθαρό ασφάλιστρο — η ανταπόδοση θα υπολογιστεί σε 0 €.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Προεπισκόπηση: {previewAmount.toFixed(2)} € (θα υπολογιστεί ξανά κατά την αποθήκευση)
        </p>
      )}
    </form>
  );
}
