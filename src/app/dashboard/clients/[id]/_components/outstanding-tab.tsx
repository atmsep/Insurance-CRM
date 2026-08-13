"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { installmentStatusVariant } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";
import { installmentRemaining } from "../../../policies/balance";
import { collectInstallmentPayment } from "../../../policies/actions";
import { CollectPaymentForm } from "../../../policies/collect-payment-form";
import {
  getClientOutstandingInstallments,
  type ClientOutstandingInstallment,
} from "../../outstanding-actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

export function OutstandingTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{
    installments: ClientOutstandingInstallment[];
    paymentMethods: { id: string; name: string }[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function refetch() {
    try {
      setLoadError(false);
      setData(await getClientOutstandingInstallments(clientId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getClientOutstandingInstallments(clientId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const total = (data?.installments ?? []).reduce((sum, i) => sum + installmentRemaining(i), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ανείσπρακτα</CardTitle>
        {data && (
          <span className="text-sm text-muted-foreground">
            Σύνολο: <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
          </span>
        )}
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των ανεξόφλητων.</p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              Δοκίμασε ξανά
            </Button>
          </div>
        ) : !data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Συμβόλαιο</TableHead>
                <TableHead>Ημ. λήξης</TableHead>
                <TableHead>Ποσό</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.installments.length ? (
                data.installments.map((inst) => {
                  const remaining = installmentRemaining(inst);
                  return (
                    <TableRow key={inst.id}>
                      <TableCell>
                        <Link href={`/dashboard/policies/${inst.policy_id}`} className="hover:underline">
                          {inst.policy_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(inst.due_date)}</TableCell>
                      <TableCell>
                        <div>{remaining.toFixed(2)} €</div>
                        {inst.status === "partially_paid" && (
                          <div className="text-xs text-muted-foreground">
                            Δόθηκαν {(inst.paid_amount ?? 0).toFixed(2)} € από {inst.amount.toFixed(2)} €
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={installmentStatusVariant(inst.status)}>
                          {STATUS_LABELS[inst.status] ?? inst.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CollectPaymentForm
                          installmentId={inst.id}
                          collectAction={async (formData: FormData) => {
                            await collectInstallmentPayment(inst.policy_id, inst.id, formData);
                            await refetch();
                          }}
                          amount={inst.amount}
                          alreadyPaid={inst.paid_amount ?? 0}
                          paymentMethods={data.paymentMethods}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Δεν υπάρχουν ανείσπρακτα.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
