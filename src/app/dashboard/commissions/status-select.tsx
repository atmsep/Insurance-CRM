"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCommissionStatus } from "./actions";
import type { CommissionStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: CommissionStatus; label: string }[] = [
  { value: "pending", label: "Εκκρεμεί" },
  { value: "invoiced", label: "Τιμολογήθηκε" },
  { value: "paid", label: "Πληρώθηκε" },
  { value: "cancelled", label: "Ακυρώθηκε" },
];

export function StatusSelect({
  commissionId,
  policyId,
  status,
}: {
  commissionId: string;
  policyId: string;
  status: CommissionStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) => {
        if (value) startTransition(() => updateCommissionStatus(commissionId, policyId, value));
      }}
    >
      <SelectTrigger className="w-36">
        <SelectValue>
          {(value: CommissionStatus) =>
            STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
