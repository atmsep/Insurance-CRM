"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClaimStatus } from "./actions";
import type { ClaimStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: ClaimStatus; label: string }[] = [
  { value: "reported", label: "Αναφέρθηκε" },
  { value: "under_review", label: "Υπό εξέταση" },
  { value: "approved", label: "Εγκρίθηκε" },
  { value: "rejected", label: "Απορρίφθηκε" },
  { value: "paid", label: "Πληρώθηκε" },
  { value: "closed", label: "Έκλεισε" },
];

export function StatusSelect({
  claimId,
  policyId,
  status,
}: {
  claimId: string;
  policyId: string;
  status: ClaimStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) => {
        if (value) startTransition(() => updateClaimStatus(claimId, policyId, value));
      }}
    >
      <SelectTrigger className="w-44">
        <SelectValue>
          {(value: ClaimStatus) => STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value}
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
