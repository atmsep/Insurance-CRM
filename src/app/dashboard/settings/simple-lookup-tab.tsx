"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";

export type LookupRow = { id: string; name: string; is_active: boolean };

type Column = {
  key: string;
  label: string;
  getValue: (r: LookupRow) => string;
  getSortKey: (r: LookupRow) => string | number;
};

export function SimpleLookupTab({
  columnLabel,
  addLabel,
  emptyLabel,
  rows,
  createAction,
  updateAction,
  toggleAction,
  deleteAction,
  onChanged,
}: {
  columnLabel: string;
  addLabel: string;
  emptyLabel: string;
  rows: LookupRow[];
  createAction: (formData: FormData) => void;
  updateAction: (id: string, formData: FormData) => Promise<{ error?: string }>;
  toggleAction: (id: string, isActive: boolean) => void;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  // Rows are fetched once by the parent and held in local state (not
  // server-rendered props), so a successful mutation needs an explicit
  // nudge to refetch — same pattern as the Κινήσεις "Απόδειξη" dialog.
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const columns: Column[] = useMemo(
    () => [
      { key: "name", label: columnLabel, getValue: (r) => r.name, getSortKey: (r) => r.name },
      {
        key: "status",
        label: "Κατάσταση",
        getValue: (r) => (r.is_active ? "Ενεργό" : "Ανενεργό"),
        getSortKey: (r) => (r.is_active ? 1 : 0),
      },
    ],
    [columnLabel],
  );

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of columns) {
      const seen = new Map<string, string | number>();
      for (const r of rows) {
        const value = col.getValue(r);
        if (!seen.has(value)) seen.set(value, col.getSortKey(r));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [columns, rows]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) =>
      columns.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(r));
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

  function handleCreate(formData: FormData) {
    createAction(formData);
    onChanged?.();
  }

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateAction(id, formData);
      if (result?.error) toast.error(result.error);
      else {
        setEditingId(null);
        onChanged?.();
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleAction(id, isActive);
      onChanged?.();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Διαγραφή "${name}";`)) return;
    startTransition(async () => {
      const result = await deleteAction(id);
      if (result?.error) toast.error(result.error);
      else onChanged?.();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((row) =>
                editingId === row.id ? (
                  <TableRow key={row.id}>
                    <TableCell colSpan={2}>
                      <form
                        id={`edit-${row.id}`}
                        action={(formData) => handleUpdate(row.id, formData)}
                      >
                        <Input name="name" defaultValue={row.name} required autoFocus className="h-8 w-56" />
                      </form>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" type="submit" form={`edit-${row.id}`} disabled={pending}>
                          Αποθήκευση
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setEditingId(null)}
                        >
                          Άκυρο
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "default" : "outline"}>
                        {row.is_active ? "Ενεργό" : "Ανενεργό"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setEditingId(row.id)}
                        >
                          Επεξεργασία
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleToggle(row.id, !row.is_active)}
                        >
                          {row.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => handleDelete(row.id, row.name)}
                        >
                          Διαγραφή
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {rows.length ? "Καμία αντιστοιχία." : emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`new-${columnLabel}`}>{columnLabel}</Label>
          <Input id={`new-${columnLabel}`} name="name" required className="w-56" />
        </div>
        <Button type="submit">{addLabel}</Button>
      </form>
    </div>
  );
}
