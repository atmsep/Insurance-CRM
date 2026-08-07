"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

export function PrioritySelect() {
  const [priority, setPriority] = useState("medium");

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Προτεραιότητα</label>
      <Select value={priority} onValueChange={(v) => setPriority(v ?? "medium")}>
        <SelectTrigger className="w-36">
          <SelectValue>{(value: string) => PRIORITY_LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="priority" value={priority} />
    </div>
  );
}
