"use client";

import { useMemo, useState, useTransition } from "react";
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
import { createBrokerOffice, toggleBrokerOfficeActive } from "./actions";

type BrokerOffice = {
  id: string;
  name: string;
  is_direct: boolean;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type Column = {
  key: string;
  label: string;
  getValue: (o: BrokerOffice) => string;
  getSortKey: (o: BrokerOffice) => string | number;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Όνομα", getValue: (o) => o.name, getSortKey: (o) => o.name },
  { key: "phone", label: "Τηλέφωνο", getValue: (o) => o.phone ?? "—", getSortKey: (o) => o.phone ?? "" },
  { key: "email", label: "Email", getValue: (o) => o.email ?? "—", getSortKey: (o) => o.email ?? "" },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (o) => (o.is_active ? "Ενεργό" : "Ανενεργό"),
    getSortKey: (o) => (o.is_active ? 1 : 0),
  },
];

export function BrokerOfficesTab({ brokerOffices }: { brokerOffices: BrokerOffice[] }) {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const o of brokerOffices) {
        const value = col.getValue(o);
        if (!seen.has(value)) seen.set(value, col.getSortKey(o));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [brokerOffices]);

  const visibleOffices = useMemo(() => {
    const filtered = brokerOffices.filter((o) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(o));
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
  }, [brokerOffices, filters, sort]);

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
            {visibleOffices.length ? (
              visibleOffices.map((office) => (
                <TableRow key={office.id}>
                  <TableCell>
                    {office.name}
                    {office.is_direct && (
                      <Badge variant="outline" className="ml-2">
                        Απευθείας συμβάσεις
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{office.phone ?? "—"}</TableCell>
                  <TableCell>{office.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={office.is_active ? "default" : "outline"}>
                      {office.is_active ? "Ενεργό" : "Ανενεργό"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!office.is_direct && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() =>
                            toggleBrokerOfficeActive(office.id, !office.is_active),
                          )
                        }
                      >
                        {office.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {brokerOffices.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν συνεργαζόμενα γραφεία."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createBrokerOffice} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="broker_name">Όνομα</Label>
          <Input id="broker_name" name="name" required className="w-56" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="broker_phone">Τηλέφωνο</Label>
          <Input id="broker_phone" name="phone" className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="broker_email">Email</Label>
          <Input id="broker_email" name="email" type="email" className="w-56" />
        </div>
        <Button type="submit">Προσθήκη γραφείου</Button>
      </form>
    </div>
  );
}
