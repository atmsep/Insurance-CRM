"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollectBulkBar } from "./collect-bulk-bar";
import { CollectFromCashRegister } from "../../cash-register/_components/collect-from-cash-register";

export type UncollectedRow = {
  id: string;
  policyId: string;
  policyNumber: string;
  riskLabel: string | null;
  line: string | null;
  carrier: string | null;
  client: string | null;
  issueDate: string | null;
  startDate: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number | null;
  status: string;
  installmentNumber: number;
  remaining: number;
  agentId: string | null;
  agentName: string;
};

export type AgentGroup = {
  agentId: string;
  agentName: string;
  rows: UncollectedRow[];
  total: number;
};

function fmt(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function Rows({
  rows,
  showAgent,
  paymentMethods,
}: {
  rows: UncollectedRow[];
  showAgent: boolean;
  paymentMethods: { id: string; name: string }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <BulkSelectAllCheckbox ids={rows.map((r) => r.id)} />
          </TableHead>
          <TableHead>Συμβόλαιο</TableHead>
          <TableHead>Χαρακτηριστικό</TableHead>
          <TableHead>Κλάδος</TableHead>
          <TableHead>Εταιρεία</TableHead>
          <TableHead>Πελάτης</TableHead>
          <TableHead>Ημ. έκδοσης</TableHead>
          <TableHead>Ημ. έναρξης</TableHead>
          <TableHead>Ημ. λήξης δόσης</TableHead>
          <TableHead className="text-right">Ποσό δόσης</TableHead>
          <TableHead className="text-right">Ανείσπρακτο</TableHead>
          {showAgent && <TableHead>Συνεργάτης</TableHead>}
          <TableHead className="no-print" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <BulkSelectCheckbox id={r.id} />
            </TableCell>
            <TableCell>
              <Link href={`/dashboard/policies/${r.policyId}`} className="hover:underline">
                {r.policyNumber}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{r.riskLabel ?? "—"}</TableCell>
            <TableCell>{r.line ?? "—"}</TableCell>
            <TableCell>{r.carrier ?? "—"}</TableCell>
            <TableCell>{r.client ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">{fmt(r.issueDate)}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">{fmt(r.startDate)}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">{fmt(r.dueDate)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.amount.toFixed(2)} €</TableCell>
            <TableCell className="text-right">
              <Badge variant="warning">{r.remaining.toFixed(2)} €</Badge>
            </TableCell>
            {showAgent && <TableCell>{r.agentName}</TableCell>}
            {/* Η είσπραξη ανά γραμμή μένει δίπλα στη μαζική: η μαζική κλείνει
                ολόκληρο το υπόλοιπο, ενώ αυτή δέχεται μερικό ποσό, επιταγή
                και δικό της αριθμό απόδειξης. */}
            <TableCell className="no-print">
              <CollectFromCashRegister
                policyId={r.policyId}
                documentLabel={r.policyNumber}
                kindLabel={null}
                installments={[
                  {
                    id: r.id,
                    installmentNumber: r.installmentNumber,
                    dueDate: r.dueDate,
                    paidDate: null,
                    amount: r.amount,
                    paidAmount: r.paidAmount,
                    status: r.status,
                  },
                ]}
                paymentMethods={paymentMethods}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function UncollectedList({
  groups,
  grouped,
  paymentMethods,
  today,
  truncated,
  shownCount,
}: {
  groups: AgentGroup[];
  /** Σε προβολή «όλοι οι συνεργάτες» σπάει σε ενότητες ανά συνεργάτη. */
  grouped: boolean;
  paymentMethods: { id: string; name: string }[];
  today: string;
  truncated: boolean;
  shownCount: number;
}) {
  const allRows = groups.flatMap((g) => g.rows);

  return (
    <BulkSelectionProvider>
      <div className="flex flex-col gap-4">
        {truncated && (
          <p className="text-xs text-amber-600 no-print">
            Δείχνονται οι πρώτες {shownCount} γραμμές. Στένεψε τα κριτήρια για να τις δεις όλες.
          </p>
        )}

        {allRows.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            Δεν υπάρχουν ανείσπρακτες δόσεις με αυτά τα κριτήρια.
          </div>
        ) : grouped ? (
          groups.map((g) => (
            <div key={g.agentId} className="rounded-md border">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2">
                <p className="text-sm font-medium">{g.agentName}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {g.rows.length} δόσεις · <span className="font-semibold text-foreground">{g.total.toFixed(2)} €</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <Rows rows={g.rows} showAgent={false} paymentMethods={paymentMethods} />
              </div>
            </div>
          ))
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Rows rows={allRows} showAgent={false} paymentMethods={paymentMethods} />
          </div>
        )}

        <CollectBulkBar paymentMethods={paymentMethods} today={today} />
      </div>
    </BulkSelectionProvider>
  );
}
