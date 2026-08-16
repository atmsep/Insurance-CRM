"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";
import {
  createInsuranceLine,
  updateInsuranceLine,
  toggleInsuranceLineActive,
  deleteInsuranceLine,
} from "./lookup-actions";

export type InsuranceLine = {
  id: string;
  code: string;
  name_el: string;
  requires_vehicle_details: boolean;
  requires_property_details: boolean;
  requires_life_health_details: boolean;
  is_active: boolean;
};

function FlagsFields({ line }: { line?: InsuranceLine }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`vehicle-${line?.id ?? "new"}`}
          name="requires_vehicle_details"
          defaultChecked={line?.requires_vehicle_details}
        />
        <Label htmlFor={`vehicle-${line?.id ?? "new"}`}>Στοιχεία οχήματος</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`property-${line?.id ?? "new"}`}
          name="requires_property_details"
          defaultChecked={line?.requires_property_details}
        />
        <Label htmlFor={`property-${line?.id ?? "new"}`}>Στοιχεία ακινήτου</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`life-${line?.id ?? "new"}`}
          name="requires_life_health_details"
          defaultChecked={line?.requires_life_health_details}
        />
        <Label htmlFor={`life-${line?.id ?? "new"}`}>Στοιχεία ζωής/υγείας</Label>
      </div>
    </div>
  );
}

function requiredDetailsLabel(line: InsuranceLine): string {
  return (
    [
      line.requires_vehicle_details && "Όχημα",
      line.requires_property_details && "Ακίνητο",
      line.requires_life_health_details && "Ζωή/Υγεία",
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

type Column = {
  key: string;
  label: string;
  getValue: (l: InsuranceLine) => string;
  getSortKey: (l: InsuranceLine) => string | number;
};

const COLUMNS: Column[] = [
  { key: "code", label: "Κωδικός", getValue: (l) => l.code, getSortKey: (l) => l.code },
  { key: "name_el", label: "Όνομα", getValue: (l) => l.name_el, getSortKey: (l) => l.name_el },
  { key: "details", label: "Απαιτεί στοιχεία", getValue: requiredDetailsLabel, getSortKey: requiredDetailsLabel },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (l) => (l.is_active ? "Ενεργός" : "Ανενεργός"),
    getSortKey: (l) => (l.is_active ? 1 : 0),
  },
];

export function InsuranceLinesTab({ lines, onChanged }: { lines: InsuranceLine[]; onChanged?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const l of lines) {
        const value = col.getValue(l);
        if (!seen.has(value)) seen.set(value, col.getSortKey(l));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [lines]);

  const visibleLines = useMemo(() => {
    const filtered = lines.filter((l) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(l));
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
  }, [lines, filters, sort]);

  function handleCreate(formData: FormData) {
    createInsuranceLine(formData);
    onChanged?.();
  }

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateInsuranceLine(id, formData);
      if (result?.error) toast.error(result.error);
      else {
        setEditingId(null);
        onChanged?.();
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleInsuranceLineActive(id, isActive);
      onChanged?.();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Διαγραφή "${name}";`)) return;
    startTransition(async () => {
      const result = await deleteInsuranceLine(id);
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLines.length ? (
              visibleLines.map((line) =>
                editingId === line.id ? (
                  <TableRow key={line.id}>
                    <TableCell>{line.code}</TableCell>
                    <TableCell colSpan={2}>
                      <form
                        id={`edit-line-${line.id}`}
                        action={(formData) => handleUpdate(line.id, formData)}
                        className="flex flex-col gap-3"
                      >
                        <Input name="name_el" defaultValue={line.name_el} required autoFocus className="h-8 w-56" />
                        <FlagsFields line={line} />
                      </form>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" type="submit" form={`edit-line-${line.id}`} disabled={pending}>
                          Αποθήκευση
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditingId(null)}>
                          Άκυρο
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={line.id}>
                    <TableCell>{line.code}</TableCell>
                    <TableCell>{line.name_el}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[
                        line.requires_vehicle_details && "Όχημα",
                        line.requires_property_details && "Ακίνητο",
                        line.requires_life_health_details && "Ζωή/Υγεία",
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={line.is_active ? "default" : "outline"}>
                        {line.is_active ? "Ενεργός" : "Ανενεργός"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingId(line.id)}>
                          Επεξεργασία
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleToggle(line.id, !line.is_active)}
                        >
                          {line.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => handleDelete(line.id, line.name_el)}
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {lines.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν κλάδοι ασφάλισης."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={handleCreate} className="flex flex-col gap-3 rounded-md border p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_line_code">Κωδικός</Label>
            <Input id="new_line_code" name="code" required className="w-32 uppercase" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_line_name">Όνομα</Label>
            <Input id="new_line_name" name="name_el" required className="w-56" />
          </div>
        </div>
        <FlagsFields />
        <Button type="submit" className="w-fit">
          Προσθήκη κλάδου
        </Button>
      </form>
    </div>
  );
}
