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
import { REFERRAL_REWARD_STATUS_LABELS } from "../../referral-labels";

export function ReferralRewardForm({
  amount,
  status,
  notes,
  rewardAction,
}: {
  amount: number | null;
  status: string | null;
  notes: string | null;
  rewardAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Base UI Select items can't use an empty string as their value, and there
  // is no "no reward" option in this dropdown — a newly configured reward
  // defaults to "pending" instead of needing an empty-string sentinel.
  const [statusValue, setStatusValue] = useState(status ?? "pending");

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{amount != null ? `${amount.toFixed(2)} €` : "—"}</span>
        {status && (
          <Badge variant={referralRewardStatusVariant(status)}>
            {REFERRAL_REWARD_STATUS_LABELS[status] ?? status}
          </Badge>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
          Επεξεργασία
        </Button>
      </div>
    );
  }

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
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Ποσό (€)</Label>
        <Input
          name="referral_reward_amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={amount ?? ""}
          className="h-7 w-24 text-xs"
        />
      </div>
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
        <input type="hidden" name="referral_reward_status" value={statusValue} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Σημειώσεις</Label>
        <Input name="referral_reward_notes" defaultValue={notes ?? ""} className="h-7 w-40 text-xs" />
      </div>
      <Button type="submit" size="sm" disabled={isSaving}>
        {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
        Άκυρο
      </Button>
    </form>
  );
}
