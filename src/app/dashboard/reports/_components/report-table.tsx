"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../../clients/[id]/_components/column-filter";

export type ReportColumn<T> = {
  key: string;
  label: string;
  getValue: (row: T) => string;
  getSortKey: (row: T) => string | number;
};

// Shared by the small aggregate tables on the Reports page — each already
// gets a handful of rows (one per status/line/source) from its own server
// action, so filtering/sorting happens entirely in memory here, same as
// every other small table in the app.
export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
}: {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of columns) {
      const seen = new Map<string, string | number>();
      for (const row of rows) {
        const value = col.getValue(row);
        if (!seen.has(value)) seen.set(value, col.getSortKey(row));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [columns, rows]);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      columns.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(row));
      }),
    );
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a);
      const kb = col.getSortKey(b);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [rows, columns, filters, sort]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
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
        {visibleRows.length ? (
          visibleRows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.key}>{col.getValue(row)}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
              {rows.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
