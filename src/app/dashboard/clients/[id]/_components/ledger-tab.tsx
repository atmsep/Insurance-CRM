import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date";

type LedgerInstallment = {
  id: string;
  policy_id: string;
  policy_number: string;
  installment_number: number;
  due_date: string;
  amount: number;
  installment_payments: { amount: number; paid_date: string; paid_at: string; is_reversed: boolean }[];
};

type LedgerEntry = {
  date: string;
  policyId: string;
  policyNumber: string;
  description: string;
  debit: number;
  credit: number;
};

type LedgerRow = LedgerEntry & { key: string; balance: number };

// Small, single-client scale (a handful of policies x a handful of
// installments/payments each) — same order of magnitude as the page's
// existing totalBilled/totalPaid/outstanding math, nowhere near the
// ~39,700-54,600-row scale that justified SQL-side security-definer RPCs
// elsewhere this session — so the running balance is just a JS reduce.
export function buildLedgerRows(installments: LedgerInstallment[]): { rows: LedgerRow[]; finalBalance: number } {
  const events: { date: string; row: LedgerEntry }[] = [];

  for (const inst of installments) {
    const policyNumber = inst.policy_number;
    events.push({
      date: inst.due_date,
      row: {
        date: inst.due_date,
        policyId: inst.policy_id,
        policyNumber,
        description: `Χρέωση δόσης #${inst.installment_number}`,
        debit: inst.amount,
        credit: 0,
      },
    });
    for (const p of inst.installment_payments ?? []) {
      if (p.is_reversed) continue;
      events.push({
        date: p.paid_date,
        row: {
          date: p.paid_date,
          policyId: inst.policy_id,
          policyNumber,
          description: `Είσπραξη δόσης #${inst.installment_number}`,
          debit: 0,
          credit: p.amount,
        },
      });
    }
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  const rows: LedgerRow[] = events.map((e, i) => {
    balance = Math.round((balance + e.row.debit - e.row.credit) * 100) / 100;
    return { key: `${e.row.description}-${i}`, ...e.row, balance };
  });

  return { rows, finalBalance: balance };
}

export function LedgerTab({
  clientId,
  installments,
}: {
  clientId: string;
  installments: LedgerInstallment[];
}) {
  const { rows, finalBalance } = buildLedgerRows(installments);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Λογιστική Καρτέλα</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/dashboard/clients/${clientId}/ledger/export`}>Λήψη (Excel)</Link>}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημερομηνία</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Περιγραφή</TableHead>
              <TableHead>Χρέωση</TableHead>
              <TableHead>Πίστωση</TableHead>
              <TableHead>Υπόλοιπο</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/policies/${row.policyId}`} className="hover:underline">
                      {row.policyNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.debit > 0 ? `${row.debit.toFixed(2)} €` : "—"}</TableCell>
                  <TableCell>{row.credit > 0 ? `${row.credit.toFixed(2)} €` : "—"}</TableCell>
                  <TableCell className="font-medium">{row.balance.toFixed(2)} €</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν κινήσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Τρέχον υπόλοιπο: <span className="font-medium text-foreground">{finalBalance.toFixed(2)} €</span>
        </p>
      </CardContent>
    </Card>
  );
}
