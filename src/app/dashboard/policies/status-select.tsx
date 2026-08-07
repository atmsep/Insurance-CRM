"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePolicyStatus } from "./actions";
import type { PolicyStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: "draft", label: "Πρόχειρο" },
  { value: "active", label: "Ενεργό" },
  { value: "pending_renewal", label: "Προς ανανέωση" },
  { value: "expired", label: "Ληγμένο" },
  { value: "cancelled", label: "Ακυρωμένο" },
  { value: "lapsed", label: "Διακοπή" },
];

export function StatusSelect({ policyId, status }: { policyId: string; status: PolicyStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) => {
        if (value) startTransition(() => updatePolicyStatus(policyId, value));
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue>
          {(value: PolicyStatus) =>
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
