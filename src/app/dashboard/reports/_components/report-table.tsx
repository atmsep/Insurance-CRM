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

export type ReportColumnDef = { key: string; label: string };
export type ReportCell = { display: string; sortKey: string | number };
export type ReportRow = { id: string; cells: Record<string, ReportCell> };

// Shared by the small aggregate tables on the Reports page — each already
// gets a handful of rows (one per status/line/source) from its own server
// action, so filtering/sorting happens entirely in memory here, same as
// every other small table in the app. Rows/columns arrive as plain,
// already-formatted data (no getValue/getSortKey functions) — a Server
// Component can't hand a Client Component a function prop (React can't
// serialize it across the boundary), so cards.tsx pre-computes each
// cell's display string + sort key before ever calling this component.
export function ReportTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: ReportColumnDef[];
  rows: ReportRow[];
  emptyMessage: string;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of columns) {
      const seen = new Map<string, string | number>();
      for (const row of rows) {
        const cell = row.cells[col.key];
        if (!cell) continue;
        if (!seen.has(cell.display)) seen.set(cell.display, cell.sortKey);
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
        const cell = row.cells[col.key];
        return !active || (cell && active.has(cell.display));
      }),
    );
    if (!sort) return filtered;
    if (!columns.some((c) => c.key === sort.key)) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = a.cells[sort.key]?.sortKey ?? "";
      const kb = b.cells[sort.key]?.sortKey ?? "";
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
            <TableRow key={row.id}>
              {columns.map((col) => (
                <TableCell key={col.key}>{row.cells[col.key]?.display ?? ""}</TableCell>
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
