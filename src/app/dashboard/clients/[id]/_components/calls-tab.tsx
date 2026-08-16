"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "./column-filter";
import { formatDateTime } from "@/lib/date";

type Call = {
  id: string;
  phone_number: string;
  notes: string | null;
  created_at: string;
};

type Column = {
  key: string;
  label: string;
  getValue: (c: Call) => string;
  getSortKey: (c: Call) => string | number;
};

const COLUMNS: Column[] = [
  { key: "created_at", label: "Ημ/νία", getValue: (c) => formatDateTime(c.created_at), getSortKey: (c) => c.created_at },
  { key: "phone_number", label: "Τηλέφωνο", getValue: (c) => c.phone_number, getSortKey: (c) => c.phone_number },
];

export function CallsTab({
  calls,
  updateNotesAction,
}: {
  calls: Call[];
  updateNotesAction: (callId: string, formData: FormData) => void | Promise<void>;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const c of calls) {
        const value = col.getValue(c);
        if (!seen.has(value)) seen.set(value, col.getSortKey(c));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [calls]);

  const visibleCalls = useMemo(() => {
    const filtered = calls.filter((c) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(c));
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
  }, [calls, filters, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Κλήσεις</CardTitle>
      </CardHeader>
      <CardContent>
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
              <TableHead>Σημείωση (τι ειπώθηκε)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCalls.length ? (
              visibleCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(call.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{call.phone_number}</TableCell>
                  <TableCell>
                    <form action={updateNotesAction.bind(null, call.id)} className="flex items-center gap-2">
                      <Input
                        name="notes"
                        defaultValue={call.notes ?? ""}
                        placeholder="Προαιρετικό — τι ειπώθηκε στην κλήση"
                        className="w-full min-w-64"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Αποθ.
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {calls.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν καταγεγραμμένες κλήσεις."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
