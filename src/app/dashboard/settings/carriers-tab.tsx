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
import { createCarrier, toggleCarrierActive } from "./actions";

type Carrier = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
};

type Column = {
  key: string;
  label: string;
  getValue: (c: Carrier) => string;
  getSortKey: (c: Carrier) => string | number;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Επωνυμία", getValue: (c) => c.name, getSortKey: (c) => c.name },
  { key: "contact_phone", label: "Τηλέφωνο", getValue: (c) => c.contact_phone ?? "—", getSortKey: (c) => c.contact_phone ?? "" },
  { key: "contact_email", label: "Email", getValue: (c) => c.contact_email ?? "—", getSortKey: (c) => c.contact_email ?? "" },
  { key: "status", label: "Κατάσταση", getValue: (c) => (c.is_active ? "Ενεργή" : "Ανενεργή"), getSortKey: (c) => (c.is_active ? 1 : 0) },
];

export function CarriersTab({ carriers }: { carriers: Carrier[] }) {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const c of carriers) {
        const value = col.getValue(c);
        if (!seen.has(value)) seen.set(value, col.getSortKey(c));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [carriers]);

  const visibleCarriers = useMemo(() => {
    const filtered = carriers.filter((c) =>
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
  }, [carriers, filters, sort]);

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
            {visibleCarriers.length ? (
              visibleCarriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell>{carrier.name}</TableCell>
                  <TableCell>{carrier.contact_phone ?? "—"}</TableCell>
                  <TableCell>{carrier.contact_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={carrier.is_active ? "default" : "outline"}>
                      {carrier.is_active ? "Ενεργή" : "Ανενεργή"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          toggleCarrierActive(carrier.id, !carrier.is_active),
                        )
                      }
                    >
                      {carrier.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {carriers.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν ασφαλιστικές εταιρείες."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createCarrier} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Επωνυμία</Label>
          <Input id="name" name="name" required className="w-56" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="legal_name">Πλήρης επωνυμία</Label>
          <Input id="legal_name" name="legal_name" className="w-64" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact_phone">Τηλέφωνο</Label>
          <Input id="contact_phone" name="contact_phone" className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact_email">Email</Label>
          <Input id="contact_email" name="contact_email" type="email" className="w-56" />
        </div>
        <Button type="submit">Προσθήκη εταιρείας</Button>
      </form>
    </div>
  );
}
