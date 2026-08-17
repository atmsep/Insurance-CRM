"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

// Multi-select counterpart to FilterSelect (single-select) — same
// form-submission approach (a hidden input tied to a `form` id), backing a
// comma-joined list of ids instead of one value. `closeOnClick={false}` on
// DropdownMenuCheckboxItem (same as ColumnFilter's own checkbox list) is
// what lets each click toggle a box without closing the menu.
export function MultiSelect({
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
  defaultValue?: string[];
  allLabel?: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue ?? []));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const triggerLabel =
    selected.size === 0
      ? allLabel
      : selected.size === 1
        ? (options.find((o) => selected.has(o.id))?.label ?? allLabel)
        : `${selected.size} επιλεγμένα`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-7 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-left text-xs text-foreground outline-none hover:bg-accent",
          className,
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.id}
            checked={selected.has(o.id)}
            onCheckedChange={() => toggle(o.id)}
            closeOnClick={false}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
      <input type="hidden" form={form} name={name} value={[...selected].join(",")} />
    </DropdownMenu>
  );
}
