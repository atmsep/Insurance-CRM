"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { installmentTip, installmentRemaining } from "../../balance";
import {
  getPolicyInstallments,
  createInstallment,
  collectInstallmentPayment,
  cancelInstallmentPayment,
} from "../../actions";
import { CollectPaymentForm } from "../../collect-payment-form";
import { CancelPaymentForm } from "../../cancel-payment-form";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
  cancelled: "Ακυρώθηκε",
};

type Installment = {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
};

export function InstallmentsTab({ policyId, isAdmin }: { policyId: string; isAdmin: boolean }) {
  const [data, setData] = useState<{
    installments: Installment[];
    paymentMethods: { id: string; name: string }[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  // The mutations below still call revalidatePath server-side, but that
  // only invalidates Next's router cache for server components — this tab
  // holds its own client-fetched state (that's the point of lazy-loading
  // it), so each action also has to trigger its own refetch afterward.
  async function refetch() {
    try {
      setLoadError(false);
      setData(await getPolicyInstallments(policyId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getPolicyInstallments(policyId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  async function addInstallmentAction(formData: FormData) {
    await createInstallment(policyId, formData);
    await refetch();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Δόσεις</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loadError ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των δόσεων.</p>
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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
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
                    const tip = installmentTip(inst);
                    return (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_number}</TableCell>
                        <TableCell>{formatDate(inst.due_date)}</TableCell>
                        <TableCell>
                          <div>{inst.amount.toFixed(2)} €</div>
                          {inst.status === "partially_paid" && (
                            <div className="text-xs text-muted-foreground">
                              Δόθηκαν {(inst.paid_amount ?? 0).toFixed(2)} € — υπόλοιπο{" "}
                              {remaining.toFixed(2)} €
                            </div>
                          )}
                          {tip > 0 && (
                            <div className="text-xs text-muted-foreground">
                              + {tip.toFixed(2)} € tip
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={installmentStatusVariant(inst.status)}>
                            {PAYMENT_STATUS_LABELS[inst.status] ?? inst.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(inst.status === "pending" ||
                            inst.status === "overdue" ||
                            inst.status === "partially_paid") && (
                            <CollectPaymentForm
                              installmentId={inst.id}
                              collectAction={async (formData) => {
                                await collectInstallmentPayment(policyId, inst.id, formData);
                                await refetch();
                              }}
                              amount={inst.amount}
                              alreadyPaid={inst.paid_amount ?? 0}
                              paymentMethods={data.paymentMethods}
                            />
                          )}
                          {isAdmin && (inst.status === "paid" || inst.status === "partially_paid") && (
                            <CancelPaymentForm
                              installmentId={inst.id}
                              cancelAction={async (formData) => {
                                await cancelInstallmentPayment(policyId, inst.id, formData);
                                await refetch();
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Δεν υπάρχουν δόσεις.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <form action={addInstallmentAction} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="due_date">Ημ. λήξης δόσης</Label>
                <Input id="due_date" name="due_date" type="date" required className="w-40" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount">Ποσό (€)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required className="w-32" />
              </div>
              <Button type="submit" variant="secondary">
                Προσθήκη δόσης
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
