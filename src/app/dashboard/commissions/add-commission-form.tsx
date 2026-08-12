"use client";

import { useEffect, useState } from "react";
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
import { getCommissionRate, getPayeeCommissionRate } from "../policies/actions";
import type { CommissionDirection } from "@/lib/database.types";

type Payee = { id: string; name: string };

export function AddCommissionForm({
  addAction,
  payees,
  premiumNet,
  carrierId,
  insuranceLineId,
  brokerOfficeId,
}: {
  addAction: (formData: FormData) => void;
  payees: Payee[];
  premiumNet?: number | null;
  carrierId: string;
  insuranceLineId: string;
  brokerOfficeId: string | null;
}) {
  const [direction, setDirection] = useState<CommissionDirection>("incoming");
  const [payeeId, setPayeeId] = useState("");
  const [baseAmount, setBaseAmount] = useState(premiumNet != null ? String(premiumNet) : "");
  const [ratePercent, setRatePercent] = useState("");
  const [amount, setAmount] = useState("");

  // Pre-fill the incoming commission rate/amount from the agreed rate for
  // this policy's broker + carrier + line, if one is configured — still a
  // plain editable input, just a default instead of always typing by hand.
  useEffect(() => {
    if (!brokerOfficeId) return;
    getCommissionRate(brokerOfficeId, carrierId, insuranceLineId).then((rate) => {
      if (rate == null) return;
      setRatePercent(String(rate));
      const base = premiumNet != null ? premiumNet : null;
      if (base != null) {
        setAmount(((base * rate) / 100).toFixed(2));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same idea for outgoing: once a payee is picked, prefill from whatever
  // rate their agreement has configured for this policy's carrier/line.
  useEffect(() => {
    if (direction !== "outgoing" || !payeeId) return;
    getPayeeCommissionRate(payeeId, carrierId, insuranceLineId).then((rate) => {
      if (rate == null) return;
      setRatePercent(String(rate));
      const base = premiumNet != null ? premiumNet : null;
      if (base != null) {
        setAmount(((base * rate) / 100).toFixed(2));
      }
    });
  }, [direction, payeeId, carrierId, insuranceLineId, premiumNet]);

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
          value={baseAmount}
          onChange={(e) => setBaseAmount(e.target.value)}
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
          value={ratePercent}
          onChange={(e) => setRatePercent(e.target.value)}
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
