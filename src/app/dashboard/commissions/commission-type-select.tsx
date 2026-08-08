"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMISSION_TYPE_LABELS } from "./commission-labels";

export function CommissionTypeSelect() {
  const [type, setType] = useState("new_business");

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Τύπος</label>
      <Select value={type} onValueChange={(v) => setType(v ?? "new_business")}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => COMMISSION_TYPE_LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(COMMISSION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="commission_type" value={type} />
    </div>
  );
}
