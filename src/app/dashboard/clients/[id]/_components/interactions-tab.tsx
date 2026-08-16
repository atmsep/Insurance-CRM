"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "./column-filter";
import { InteractionTypeSelect } from "../../interaction-type-select";
import { INTERACTION_TYPE_LABELS } from "../../interaction-labels";
import { formatDateTime } from "@/lib/date";

type Interaction = {
  id: string;
  interaction_type: string;
  subject: string | null;
  notes: string | null;
  interaction_date: string;
  follow_up_needed: boolean;
};

type Column = {
  key: string;
  label: string;
  getValue: (i: Interaction) => string;
  getSortKey: (i: Interaction) => string | number;
};

const COLUMNS: Column[] = [
  {
    key: "interaction_date",
    label: "Ημ/νία",
    getValue: (i) => formatDateTime(i.interaction_date),
    getSortKey: (i) => i.interaction_date,
  },
  {
    key: "interaction_type",
    label: "Τύπος",
    getValue: (i) => INTERACTION_TYPE_LABELS[i.interaction_type] ?? i.interaction_type,
    getSortKey: (i) => INTERACTION_TYPE_LABELS[i.interaction_type] ?? i.interaction_type,
  },
  { key: "subject", label: "Θέμα", getValue: (i) => i.subject ?? "—", getSortKey: (i) => i.subject ?? "" },
  { key: "notes", label: "Σημειώσεις", getValue: (i) => i.notes ?? "—", getSortKey: (i) => i.notes ?? "" },
  {
    key: "follow_up_needed",
    label: "Follow-up",
    getValue: (i) => (i.follow_up_needed ? "Ναι" : "—"),
    getSortKey: (i) => (i.follow_up_needed ? 1 : 0),
  },
];

export function InteractionsTab({
  interactions,
  addInteractionAction,
}: {
  interactions: Interaction[];
  addInteractionAction: (formData: FormData) => void | Promise<void>;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const i of interactions) {
        const value = col.getValue(i);
        if (!seen.has(value)) seen.set(value, col.getSortKey(i));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [interactions]);

  const visibleInteractions = useMemo(() => {
    const filtered = interactions.filter((i) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(i));
      }),
    );
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a);
      const kb = col.getSortKey(b);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [interactions, filters, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Επικοινωνία</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={col.label}
                    options={optionsByColumn.get(col.key) ?? []}
                    active={filters[col.key] ?? null}
                    onChange={(next) => setFilters((f) => ({ ...f, [col.key]: next }))}
                    sortDirection={sort?.key === col.key ? sort.direction : null}
                    onSort={(direction) => setSort(direction ? { key: col.key, direction } : null)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleInteractions.length ? (
              visibleInteractions.map((interaction) => (
                <TableRow key={interaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(interaction.interaction_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {INTERACTION_TYPE_LABELS[interaction.interaction_type] ?? interaction.interaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{interaction.subject ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{interaction.notes ?? "—"}</TableCell>
                  <TableCell>{interaction.follow_up_needed ? "Ναι" : "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {interactions.length
                    ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα."
                    : "Δεν υπάρχει ιστορικό επικοινωνίας."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form action={addInteractionAction} className="flex flex-wrap items-end gap-3">
          <InteractionTypeSelect />
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Θέμα</Label>
            <Input id="subject" name="subject" className="w-56" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes-interaction">Σημειώσεις</Label>
            <Input id="notes-interaction" name="notes" className="w-72" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="follow_up_needed" className="size-4" />
            Χρειάζεται follow-up
          </label>
          <Button type="submit" variant="secondary">
            Καταχώρηση
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
