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
import { createPaymentMethod, togglePaymentMethodActive } from "./actions";

type PaymentMethod = { id: string; name: string; is_active: boolean };

export function PaymentMethodsTab({ paymentMethods }: { paymentMethods: PaymentMethod[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentMethods.length ? (
              paymentMethods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>{method.name}</TableCell>
                  <TableCell>
                    <Badge variant={method.is_active ? "default" : "outline"}>
                      {method.is_active ? "Ενεργή" : "Ανενεργή"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          togglePaymentMethodActive(method.id, !method.is_active),
                        )
                      }
                    >
                      {method.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Δεν υπάρχουν μέθοδοι πληρωμής.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createPaymentMethod} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="method_name">Όνομα</Label>
          <Input id="method_name" name="name" required className="w-56" />
        </div>
        <Button type="submit">Προσθήκη μεθόδου</Button>
      </form>
    </div>
  );
}
