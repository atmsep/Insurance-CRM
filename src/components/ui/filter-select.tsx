"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; label: string };

const ALL_VALUE = "__all__";

// Label-less Select for embedded list-page filter rows: submits via a
// hidden input tied to a `form` id, like the raw <select>s it replaces, and
// always exposes a clear/"all" option since Base UI Select items can't use
// an empty string as their value.
export function FilterSelect({
  form,
  name,
  options,
  defaultValue,
  allLabel = "Όλα",
  className,
}: {
  form: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  allLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue || ALL_VALUE);

  return (
    <>
      <Select value={value} onValueChange={(v) => setValue(v ?? ALL_VALUE)}>
        <SelectTrigger size="sm" className={className ?? "h-7 w-full text-xs"}>
          <SelectValue>
            {(v: string) =>
              v === ALL_VALUE ? allLabel : (options.find((o) => o.id === v)?.label ?? allLabel)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" form={form} name={name} value={value === ALL_VALUE ? "" : value} />
    </>
  );
}
