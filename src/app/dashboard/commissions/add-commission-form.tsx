"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommissionTypeSelect } from "./commission-type-select";
import { COMMISSION_DIRECTION_LABELS } from "./direction-labels";
import type { CommissionDirection } from "@/lib/database.types";

type Payee = { id: string; name: string };

export function AddCommissionForm({
  addAction,
  payees,
  premiumNet,
}: {
  addAction: (formData: FormData) => void;
  payees: Payee[];
  premiumNet?: number | null;
}) {
  const [direction, setDirection] = useState<CommissionDirection>("incoming");
  const [payeeId, setPayeeId] = useState("");

  return (
    <form action={addAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label>Κατεύθυνση</Label>
        <Select
          value={direction}
          onValueChange={(v) => setDirection((v as CommissionDirection) ?? "incoming")}
        >
          <SelectTrigger className="w-36">
            <SelectValue>
              {(value: string) => COMMISSION_DIRECTION_LABELS[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMMISSION_DIRECTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="direction" value={direction} />
      </div>

      <CommissionTypeSelect />

      {direction === "outgoing" && (
        <div className="flex flex-col gap-2">
          <Label>Δικαιούχος</Label>
          <Select value={payeeId} onValueChange={(v) => setPayeeId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue>
                {(value: string) => payees.find((p) => p.id === value)?.name ?? "Επίλεξε δικαιούχο"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {payees.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="payee_id" value={payeeId} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="base_amount">Βάση (€)</Label>
        <Input
          id="base_amount"
          name="base_amount"
          type="number"
          step="0.01"
          defaultValue={premiumNet ?? undefined}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="commission_rate_percent">Ποσοστό (%)</Label>
        <Input
          id="commission_rate_percent"
          name="commission_rate_percent"
          type="number"
          step="0.01"
          className="w-24"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="commission_amount">Ποσό (€)</Label>
        <Input
          id="commission_amount"
          name="commission_amount"
          type="number"
          step="0.01"
          required
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="period">Περίοδος</Label>
        <Input id="period" name="period" type="date" className="w-40" />
      </div>
      <Button type="submit" variant="secondary">
        Προσθήκη προμήθειας
      </Button>
    </form>
  );
}
