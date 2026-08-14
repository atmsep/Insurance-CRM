"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getPolicyCommissions,
  getPolicyInstallments,
  collectInstallmentPayment,
  type PolicyMovement,
} from "../../actions";
import { CollectPaymentForm } from "../../collect-payment-form";
import { CommissionsSection } from "../../../commissions/commissions-section";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

async function getReceiptData(movementId: string) {
  const [commissionData, installmentData] = await Promise.all([
    getPolicyCommissions(movementId),
    getPolicyInstallments(movementId),
  ]);
  return { ...commissionData, ...installmentData };
}

type ReceiptData = Awaited<ReturnType<typeof getReceiptData>>;

export function MovementReceiptSheet({
  movement,
  open,
  onOpenChange,
  isAdmin,
  onPaymentCollected,
}: {
  movement: PolicyMovement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  // The outer Κινήσεις list has its own copy of each movement's Υπόλοιπο
  // (and the chain-wide total) fetched once when the tab loads — a
  // collection made in here would otherwise leave that summary stale
  // until the tab is remounted.
  onPaymentCollected?: () => void;
}) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const movementId = movement?.id ?? null;

  async function refetch() {
    if (!movementId) return;
    try {
      setLoadError(false);
      setData(await getReceiptData(movementId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    if (!open || !movementId) return;
    let cancelled = false;
    getReceiptData(movementId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, movementId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Απόδειξη {movement?.document_label}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4">
          {movement && (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Είδος</span>
                <span>{movement.kind}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Έναρξη</span>
                <span>{formatDate(movement.start_date)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Λήξη</span>
                <span>{formatDate(movement.end_date)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Καθ. ασφ.</span>
                <span>{movement.premium_net != null ? `${movement.premium_net.toFixed(2)} €` : "—"}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Μικτά ασφ.</span>
                <span>{movement.premium_gross.toFixed(2)} €</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Υπόλοιπο</span>
                <span className={movement.outstanding > 0 ? "font-medium text-destructive" : ""}>
                  {movement.outstanding.toFixed(2)} €
                </span>
              </div>
            </div>
          )}

          {loadError ? (
            <div className="flex flex-col items-start gap-2 text-sm">
              <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση.</p>
              <Button type="button" variant="outline" size="sm" onClick={refetch}>
                Δοκίμασε ξανά
              </Button>
            </div>
          ) : !data ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {movementId && (
                <CommissionsSection
                  policyId={movementId}
                  carrierId={data.carrierId ?? ""}
                  insuranceLineId={data.insuranceLineId ?? ""}
                  brokerOfficeId={data.brokerOfficeId}
                  commissions={data.commissions}
                  isAdmin={isAdmin}
                  premiumNet={data.premiumNet}
                  payees={data.payees}
                  onCommissionAdded={refetch}
                />
              )}

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Δόσεις</h3>
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
                                    await collectInstallmentPayment(movementId!, inst.id, formData);
                                    await refetch();
                                    onPaymentCollected?.();
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
                          Δεν υπάρχουν δόσεις.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/policies/${movementId}`}>Άνοιγμα πλήρους σελίδας</Link>}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
