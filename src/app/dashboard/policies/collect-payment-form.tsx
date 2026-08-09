"use client";

import { useState } from "react";
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

type PaymentMethod = { id: string; name: string };

export function CollectPaymentForm({
  installmentId,
  collectAction,
  amount,
  paymentMethods,
}: {
  installmentId: string;
  collectAction: (formData: FormData) => void;
  amount: number;
  paymentMethods: PaymentMethod[];
}) {
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState("");

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Είσπραξη
      </Button>
    );
  }

  return (
    <form action={collectAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`paid_amount_${installmentId}`} className="text-xs">
          Ποσό
        </Label>
        <Input
          id={`paid_amount_${installmentId}`}
          name="paid_amount"
          type="number"
          step="0.01"
          defaultValue={amount}
          className="h-7 w-24 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Μέθοδος</Label>
        <Select value={methodId} onValueChange={(v) => setMethodId(v ?? "")}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue>
              {(value: string) => paymentMethods.find((m) => m.id === value)?.name ?? "Επίλεξε"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {paymentMethods.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="payment_method_id" value={methodId} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Απόδειξη</Label>
        <Input name="receipt_number" className="h-7 w-24 text-xs" />
      </div>
      <Button type="submit" size="sm">
        Καταχώρηση
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Άκυρο
      </Button>
    </form>
  );
}
