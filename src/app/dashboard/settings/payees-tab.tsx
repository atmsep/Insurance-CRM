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
import { createPayee, togglePayeeActive } from "./actions";

type Payee = {
  id: string;
  name: string;
  is_external: boolean;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export function PayeesTab({ payees }: { payees: Payee[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payees.length ? (
              payees.map((payee) => (
                <TableRow key={payee.id}>
                  <TableCell>{payee.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {payee.is_external ? "Εξωτερικός" : "Εσωτερικός"}
                    </Badge>
                  </TableCell>
                  <TableCell>{payee.phone ?? "—"}</TableCell>
                  <TableCell>{payee.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={payee.is_active ? "default" : "outline"}>
                      {payee.is_active ? "Ενεργός" : "Ανενεργός"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          togglePayeeActive(payee.id, !payee.is_active),
                        )
                      }
                    >
                      {payee.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν δικαιούχοι προμηθειών.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createPayee} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="payee_name">Όνομα</Label>
          <Input id="payee_name" name="name" required className="w-56" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="payee_phone">Τηλέφωνο</Label>
          <Input id="payee_phone" name="phone" className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="payee_email">Email</Label>
          <Input id="payee_email" name="email" type="email" className="w-56" />
        </div>
        <Button type="submit">Προσθήκη δικαιούχου</Button>
      </form>
    </div>
  );
}
