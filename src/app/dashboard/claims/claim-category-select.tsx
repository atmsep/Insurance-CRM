"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClaimCategorySelect({
  categories,
  defaultValue,
}: {
  categories: { id: string; name: string }[];
  defaultValue?: string;
}) {
  const [categoryId, setCategoryId] = useState(defaultValue ?? "");

  return (
    <>
      <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
        <SelectTrigger>
          <SelectValue>
            {(value: string) => categories.find((c) => c.id === value)?.name ?? "Επίλεξε"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="claim_category_id" value={categoryId} />
    </>
  );
}
