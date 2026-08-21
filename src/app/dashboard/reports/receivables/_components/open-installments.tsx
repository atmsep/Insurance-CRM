"use client";

import Link from "next/link";
import { BulkSelectionProvider, BulkSelectCheckbox, BulkSelectAllCheckbox } from "@/components/bulk-selection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollectBulkBar } from "./collect-bulk-bar";

export type OpenInstallment = {
  id: string;
  policyId: string;
  policyNumber: string;
  clientId: string;
  clientName: string;
  dueDate: string;
  remaining: number;
  overdueDays: number;
};

export function OpenInstallments({
  rows,
  paymentMethods,
  today,
  truncated,
}: {
  rows: OpenInstallment[];
  paymentMethods: { id: string; name: string }[];
  today: string;
  truncated: boolean;
}) {
  const ids = rows.map((r) => r.id);
  const total = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <BulkSelectionProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            Ανοιχτές δόσεις
            <span className="ml-2 font-normal text-muted-foreground">
              {rows.length} γραμμές · {total.toFixed(2)} €
            </span>
          </p>
          {truncated && (
            <p className="text-xs text-amber-600">
              Δείχνονται οι πρώτες {rows.length}. Στένεψε τα κριτήρια για να τις δεις όλες.
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <BulkSelectAllCheckbox ids={ids} />
                </TableHead>
                <TableHead>Πελάτης</TableHead>
                <TableHead>Συμβόλαιο</TableHead>
                <TableHead>Λήξη δόσης</TableHead>
                <TableHead className="text-right">Καθυστέρηση</TableHead>
                <TableHead className="text-right">Υπόλοιπο</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <BulkSelectCheckbox id={r.id} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/clients/${r.clientId}`} className="hover:underline">
                        {r.clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${r.policyId}`} className="hover:underline">
                        {r.policyNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.dueDate}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.overdueDays > 0 ? `${r.overdueDays} ημ.` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {r.remaining.toFixed(2)} €
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Καμία ανοιχτή δόση με αυτά τα κριτήρια.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <CollectBulkBar paymentMethods={paymentMethods} today={today} />
      </div>
    </BulkSelectionProvider>
  );
}
