"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";
import { createCarrier, toggleCarrierActive, updateCarrier } from "./actions";

type Carrier = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  assistance_phone: string | null;
  claims_phone: string | null;
  claims_email: string | null;
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

function EditCarrierDialog({ carrier, onClose }: { carrier: Carrier; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Επεξεργασία εταιρείας</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await updateCarrier(carrier.id, formData);
            onClose();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_name">Επωνυμία</Label>
            <Input id="edit_name" name="name" defaultValue={carrier.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_legal_name">Πλήρης επωνυμία</Label>
            <Input id="edit_legal_name" name="legal_name" defaultValue={carrier.legal_name ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit_contact_phone">Τηλέφωνο</Label>
              <Input id="edit_contact_phone" name="contact_phone" defaultValue={carrier.contact_phone ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit_contact_email">Email</Label>
              <Input id="edit_contact_email" name="contact_email" type="email" defaultValue={carrier.contact_email ?? ""} />
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-3 rounded-md border p-3">
            <p className="text-sm font-medium">Στοιχεία για άμεση χρήση (εμφανίζονται στο συμβόλαιο)</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit_assistance_phone">Τηλέφωνο φροντίδας ατυχήματος</Label>
              <Input id="edit_assistance_phone" name="assistance_phone" defaultValue={carrier.assistance_phone ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit_claims_phone">Τηλέφωνο κλάδου ζημιών</Label>
                <Input id="edit_claims_phone" name="claims_phone" defaultValue={carrier.claims_phone ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit_claims_email">Email ζημιών</Label>
                <Input id="edit_claims_email" name="claims_email" type="email" defaultValue={carrier.claims_email ?? ""} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Αποθήκευση</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CarriersTab({ carriers }: { carriers: Carrier[] }) {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);

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
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingCarrier(carrier)}>
                        Επεξεργασία
                      </Button>
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
                    </div>
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

      {editingCarrier && (
        <EditCarrierDialog carrier={editingCarrier} onClose={() => setEditingCarrier(null)} />
      )}

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
