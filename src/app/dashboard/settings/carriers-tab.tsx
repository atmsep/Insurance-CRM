"use client";

import { useTransition } from "react";
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
import { createCarrier, toggleCarrierActive } from "./actions";

type Carrier = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
};

export function CarriersTab({ carriers }: { carriers: Carrier[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Επωνυμία</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carriers.length ? (
              carriers.map((carrier) => (
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
                  Δεν υπάρχουν ασφαλιστικές εταιρείες.
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
