"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePolicyStatus, resetPolicyStatusToAuto } from "./actions";
import type { PolicyStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: "draft", label: "Πρόχειρο" },
  { value: "active", label: "Ενεργό" },
  { value: "pending_renewal", label: "Προς ανανέωση" },
  { value: "expired", label: "Ληγμένο" },
  { value: "cancelled", label: "Ακυρωμένο" },
  { value: "lapsed", label: "Διακοπή" },
];

export function StatusSelect({
  policyId,
  status,
  statusAutoManaged,
}: {
  policyId: string;
  status: PolicyStatus;
  statusAutoManaged: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
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
      {!statusAutoManaged && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pending}
          title="Επαναφορά σε αυτόματη διαχείριση κατάστασης"
          onClick={() =>
            startTransition(async () => {
              await resetPolicyStatusToAuto(policyId);
            })
          }
        >
          <RotateCcw className="size-4" />
        </Button>
      )}
    </div>
  );
}
