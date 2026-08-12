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
import { installmentRemaining } from "../../balance";
import {
  getPolicyInstallments,
  createInstallment,
  collectInstallmentPayment,
  reverseInstallmentPayment,
  type InstallmentWithPayments,
} from "../../actions";
import { CollectPaymentForm } from "../../collect-payment-form";
import { CancelPaymentForm } from "../../cancel-payment-form";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

type Installment = InstallmentWithPayments;

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });
}

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

  const payments = (data?.installments ?? [])
    .flatMap((inst) =>
      (inst.installment_payments ?? []).map((p) => ({ ...p, installmentNumber: inst.installment_number })),
    )
    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Εισπράξεις</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {loadError ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των εισπράξεων.</p>
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Δεν υπάρχουν εισπράξεις.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <form action={addInstallmentAction} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="due_date">Ημ. λήξης</Label>
                <Input id="due_date" name="due_date" type="date" required className="w-40" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount">Ποσό (€)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required className="w-32" />
              </div>
              <Button type="submit" variant="secondary">
                Προσθήκη είσπραξης
              </Button>
            </form>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Κινήσεις</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ημερομηνία</TableHead>
                    <TableHead>Ποσό</TableHead>
                    <TableHead>Μέθοδος</TableHead>
                    <TableHead>Απόδειξη</TableHead>
                    <TableHead>Εισπράκτορας</TableHead>
                    <TableHead>Κατάσταση</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length ? (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                        <TableCell>{p.amount.toFixed(2)} €</TableCell>
                        <TableCell>{one(p.payment_methods)?.name ?? "—"}</TableCell>
                        <TableCell>{p.receipt_number ?? "—"}</TableCell>
                        <TableCell>{one(p.agency_users)?.full_name ?? "—"}</TableCell>
                        <TableCell>
                          {p.is_reversed ? (
                            <div>
                              <Badge variant="destructive">Ακυρώθηκε</Badge>
                              {p.reversal_reason && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {p.reversal_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="success">Ενεργή</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin && !p.is_reversed && (
                            <CancelPaymentForm
                              id={p.id}
                              cancelAction={async (formData) => {
                                await reverseInstallmentPayment(policyId, p.id, formData);
                                await refetch();
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Δεν υπάρχουν κινήσεις ακόμα.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
