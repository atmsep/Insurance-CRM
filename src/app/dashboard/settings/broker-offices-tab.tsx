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
import { createBrokerOffice, toggleBrokerOfficeActive } from "./actions";

type BrokerOffice = {
  id: string;
  name: string;
  is_direct: boolean;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export function BrokerOfficesTab({ brokerOffices }: { brokerOffices: BrokerOffice[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokerOffices.length ? (
              brokerOffices.map((office) => (
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
                  Δεν υπάρχουν συνεργαζόμενα γραφεία.
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
