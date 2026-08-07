"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERACTION_TYPE_LABELS } from "./interaction-labels";

export function InteractionTypeSelect() {
  const [type, setType] = useState("call");

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Τύπος</label>
      <Select value={type} onValueChange={(v) => setType(v ?? "call")}>
        <SelectTrigger className="w-36">
          <SelectValue>{(value: string) => INTERACTION_TYPE_LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="interaction_type" value={type} />
    </div>
  );
}
