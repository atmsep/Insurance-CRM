"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";
import { formatDateTime } from "@/lib/date";

type ErrorEntry = {
  id: string;
  context: string;
  message: string;
  url: string | null;
  created_at: string;
};

type Column = {
  key: string;
  label: string;
  getValue: (e: ErrorEntry) => string;
  getSortKey: (e: ErrorEntry) => string | number;
};

const COLUMNS: Column[] = [
  { key: "created_at", label: "Ημ/νία", getValue: (e) => formatDateTime(e.created_at), getSortKey: (e) => e.created_at },
  { key: "context", label: "Πλαίσιο", getValue: (e) => e.context, getSortKey: (e) => e.context },
  { key: "message", label: "Μήνυμα", getValue: (e) => e.message, getSortKey: (e) => e.message },
  { key: "url", label: "Σελίδα", getValue: (e) => e.url ?? "—", getSortKey: (e) => e.url ?? "" },
];

export function ErrorsTab({ errors }: { errors: ErrorEntry[] }) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const e of errors) {
        const value = col.getValue(e);
        if (!seen.has(value)) seen.set(value, col.getSortKey(e));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [errors]);

  const visibleErrors = useMemo(() => {
    const filtered = errors.filter((e) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(e));
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
  }, [errors, filters, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Πρόσφατα σφάλματα</CardTitle>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleErrors.length ? (
              visibleErrors.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.context}</TableCell>
                  <TableCell className="max-w-md truncate" title={e.message}>
                    {e.message}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={e.url ?? ""}>
                    {e.url ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {errors.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν έχουν καταγραφεί σφάλματα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
