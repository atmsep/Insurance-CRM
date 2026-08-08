"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentFrequency } from "@/lib/database.types";

export const PAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  annual: "Ετήσια",
  semiannual: "Εξαμηνιαία",
  quarterly: "Τριμηνιαία",
  monthly: "Μηνιαία",
  single_premium: "Εφάπαξ",
};

export function PaymentFrequencySelect({ defaultValue }: { defaultValue: PaymentFrequency }) {
  const [value, setValue] = useState<string>(defaultValue);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor="payment_frequency_trigger">
        Συχνότητα
      </label>
      <Select value={value} onValueChange={(v) => setValue(v ?? defaultValue)}>
        <SelectTrigger id="payment_frequency_trigger" className="w-full">
          <SelectValue>{(v: string) => PAYMENT_FREQUENCY_LABELS[v] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PAYMENT_FREQUENCY_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="payment_frequency" value={value} />
    </div>
  );
}
