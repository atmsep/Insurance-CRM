"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon, ListFilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; sortKey: string | number };
export type SortDirection = "asc" | "desc";

export function ColumnFilter({
  label,
  options,
  active,
  onChange,
  sortDirection,
  onSort,
}: {
  label: string;
  options: FilterOption[];
  active: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
  sortDirection: SortDirection | null;
  onSort: (direction: SortDirection | null) => void;
}) {
  const [search, setSearch] = useState("");
  const isFiltered = active !== null;

  const sorted = useMemo(
    () => [...options].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)),
    [options],
  );
  const visible = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter((o) => o.value.toLowerCase().includes(q));
  }, [sorted, search]);

  function toggle(value: string) {
    const current = active ?? new Set(options.map((o) => o.value));
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Selecting every option is equivalent to no filter at all.
    onChange(next.size === options.length ? null : next);
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <DropdownMenuTrigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-medium text-foreground outline-none hover:text-primary focus-visible:text-primary",
          (isFiltered || sortDirection) && "text-primary",
        )}
      >
        <span>{label}</span>
        {sortDirection === "asc" ? (
          <ArrowUpNarrowWideIcon className="size-3.5 shrink-0" />
        ) : sortDirection === "desc" ? (
          <ArrowDownWideNarrowIcon className="size-3.5 shrink-0" />
        ) : null}
        <ListFilterIcon className={cn("size-3.5 shrink-0", isFiltered && "fill-primary/20")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex flex-col gap-0.5 p-1">
          <DropdownMenuItem
            className={cn(sortDirection === "asc" && "bg-accent text-accent-foreground")}
            onClick={() => onSort(sortDirection === "asc" ? null : "asc")}
          >
            <ArrowUpNarrowWideIcon />
            Μικρότερο → Μεγαλύτερο
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(sortDirection === "desc" && "bg-accent text-accent-foreground")}
            onClick={() => onSort(sortDirection === "desc" ? null : "desc")}
          >
            <ArrowDownWideNarrowIcon />
            Μεγαλύτερο → Μικρότερο
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 p-1">
          <Input
            placeholder="Αναζήτηση…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-sm"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="flex-1"
              onClick={() => onChange(null)}
            >
              Επιλογή όλων
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="flex-1"
              onClick={() => onChange(new Set())}
            >
              Καθαρισμός
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {visible.length ? (
            visible.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={active === null || active.has(option.value)}
                onCheckedChange={() => toggle(option.value)}
                closeOnClick={false}
              >
                {option.value}
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">Καμία τιμή.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
