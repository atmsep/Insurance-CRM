"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { POLICY_MOVEMENT_KIND_LABELS } from "../../movement-labels";
import {
  getMovementReceipt,
  collectInstallmentPayment,
  togglePremiumRemittance,
  toggleOutgoingCommissionRemittance,
  transferMovement,
  updateIncomingCommission,
  updateOutgoingCommission,
  type MovementReceiptData,
  type MovementRow,
} from "../../movements-actions";
import { CollectPaymentDialog } from "./collect-payment-dialog";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

type Installment = MovementReceiptData["installments"][number];

// Shared by the incoming/outgoing commission blocks — "Ειδική
// εισερχόμενη/εξερχόμενη προμήθεια" in Profia: check the box to reveal a
// plain ποσοστό/ποσό form and overwrite (or, when nothing ever
// auto-resolved, fill in for the first time) whatever
// createMovementForPolicy calculated. Ποσοστό and ποσό are linked to the
// same base (the movement's premium_net, matching how the auto-calculated
// figure is derived): editing either one recomputes the other, same as
// the "Βάσει σύμβασης" auto-fill this replaces.
function CommissionEditForm({
  ratePercent,
  amount,
  isManualOverride,
  baseAmount,
  action,
  onSaved,
}: {
  ratePercent: number | null;
  amount: number | null;
  isManualOverride: boolean;
  baseAmount: number | null;
  action: (formData: FormData) => Promise<{ error: string } | undefined>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(isManualOverride);
  const [rateInput, setRateInput] = useState(ratePercent != null ? String(ratePercent) : "");
  const [amountInput, setAmountInput] = useState(amount != null ? String(amount) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRateChange(value: string) {
    setRateInput(value);
    const rate = Number(value);
    if (value !== "" && Number.isFinite(rate) && baseAmount != null) {
      setAmountInput((Math.round(((baseAmount * rate) / 100) * 100) / 100).toFixed(2));
    }
  }

  function handleAmountChange(value: string) {
    setAmountInput(value);
    const nextAmount = Number(value);
    if (value !== "" && Number.isFinite(nextAmount) && baseAmount != null && baseAmount > 0) {
      setRateInput((Math.round(((nextAmount / baseAmount) * 100) * 100) / 100).toFixed(2));
    }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await action(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={editing} onCheckedChange={(v) => setEditing(v === true)} />
        Ειδική προμήθεια (χειροκίνητα)
      </label>
      {editing && (
        <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Ποσοστό %</Label>
            <Input
              name="commission_rate_percent"
              type="number"
              step="0.01"
              value={rateInput}
              onChange={(e) => handleRateChange(e.target.value)}
              className="h-7 w-20 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Ποσό €</Label>
            <Input
              name="commission_amount"
              type="number"
              step="0.01"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              required
              className="h-7 w-24 text-xs"
            />
          </div>
          <input type="hidden" name="is_manual_override" value="on" />
          <Button type="submit" size="xs" disabled={pending}>
            Αποθήκευση
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function MovementReceiptDialog({
  movementId,
  movementSummary,
  open,
  onOpenChange,
  isAdmin,
  policyId,
  onChanged,
}: {
  movementId: string | null;
  movementSummary: MovementRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  policyId: string;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<MovementReceiptData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [collectingInstallment, setCollectingInstallment] = useState<Installment | null>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  async function refetch() {
    if (!movementId) return;
    try {
      setLoadError(false);
      setData(await getMovementReceipt(movementId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    if (!open || !movementId) return;
    let cancelled = false;
    getMovementReceipt(movementId)
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Απόδειξη {movementSummary?.documentNumber}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
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
                <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Είδος</span>
                      <span>{POLICY_MOVEMENT_KIND_LABELS[data.movement.kind] ?? data.movement.kind}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ημ.Έκδοσης</span>
                      <span>{formatDate(data.movement.issueDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ημ.Έναρξης</span>
                      <span>{formatDate(data.movement.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ημ.Λήξης</span>
                      <span>{formatDate(data.movement.endDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Αίτηση Profia</span>
                      <span>{data.movement.applicationNumber ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Καθ.Ασφάλιστρα</span>
                      <span>{data.movement.premiumNet != null ? `${data.movement.premiumNet.toFixed(2)} €` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Μικτά Ασφάλιστρα</span>
                      <span>{data.movement.premiumGross.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Υπόλοιπο</span>
                      <span className={movementSummary && movementSummary.outstanding > 0 ? "text-destructive" : ""}>
                        {movementSummary?.outstanding.toFixed(2) ?? "0.00"} €
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Εισερχόμενη προμήθεια</h3>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Βάσει εταιρίας</span>
                      <span>
                        {data.incoming?.referenceAmount != null
                          ? `${data.incoming.referenceAmount.toFixed(2)} € (${data.incoming.referenceRatePercent}%)`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Βάσει σύμβασης</span>
                      <span>
                        {data.incoming
                          ? `${data.incoming.amount.toFixed(2)} € (${data.incoming.rateePercent ?? 0}%)`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={data.movement.premiumRemittedAt ? "text-success" : "text-muted-foreground"}>
                        {data.movement.premiumRemittedAt
                          ? `Αποδόθηκαν τα ασφάλιστρα (${formatDate(data.movement.premiumRemittedAt)})`
                          : "Δεν έχουν αποδοθεί τα ασφάλιστρα"}
                      </span>
                      {isAdmin && movementId && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={async () => {
                            await togglePremiumRemittance(movementId, Boolean(data.movement.premiumRemittedAt));
                            await refetch();
                            onChanged?.();
                          }}
                        >
                          Απόδοση ασφαλίστρων
                        </Button>
                      )}
                    </div>
                    {isAdmin && movementId && (
                      <CommissionEditForm
                        ratePercent={data.incoming?.rateePercent ?? null}
                        amount={data.incoming?.amount ?? null}
                        isManualOverride={data.incoming?.isManualOverride ?? false}
                        baseAmount={data.movement.premiumNet}
                        action={updateIncomingCommission.bind(null, movementId)}
                        onSaved={async () => {
                          await refetch();
                          onChanged?.();
                        }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">
                      Εξερχόμενη προμήθεια — {data.movement.outgoingAgentName ?? "—"}
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ποσό</span>
                      <span>
                        {data.outgoing ? `${data.outgoing.amount.toFixed(2)} € (${data.outgoing.ratePercent ?? 0}%)` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          data.movement.outgoingCommissionRemittedAt ? "text-success" : "text-muted-foreground"
                        }
                      >
                        {data.movement.outgoingCommissionRemittedAt
                          ? `Αποδόθηκαν οι προμήθειες (${formatDate(data.movement.outgoingCommissionRemittedAt)})`
                          : "Δεν έχουν αποδοθεί οι εξερχόμενες προμήθειες"}
                      </span>
                      {isAdmin && movementId && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={async () => {
                            await toggleOutgoingCommissionRemittance(
                              movementId,
                              Boolean(data.movement.outgoingCommissionRemittedAt),
                            );
                            await refetch();
                            onChanged?.();
                          }}
                        >
                          Απόδοση προμηθειών
                        </Button>
                      )}
                    </div>
                    {isAdmin && movementId && (
                      <CommissionEditForm
                        ratePercent={data.outgoing?.ratePercent ?? null}
                        amount={data.outgoing?.amount ?? null}
                        isManualOverride={data.outgoing?.isManualOverride ?? false}
                        baseAmount={data.movement.premiumNet}
                        action={updateOutgoingCommission.bind(null, movementId)}
                        onSaved={async () => {
                          await refetch();
                          onChanged?.();
                        }}
                      />
                    )}
                  </div>
                </div>

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
                          const remaining = installmentRemaining({ amount: inst.amount, paid_amount: inst.paidAmount });
                          return (
                            <TableRow key={inst.id}>
                              <TableCell>{inst.installmentNumber}</TableCell>
                              <TableCell>{formatDate(inst.dueDate)}</TableCell>
                              <TableCell>
                                <div>{inst.amount.toFixed(2)} €</div>
                                {inst.status === "partially_paid" && (
                                  <div className="text-xs text-muted-foreground">
                                    Δόθηκαν {(inst.paidAmount ?? 0).toFixed(2)} € — υπόλοιπο {remaining.toFixed(2)} €
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
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCollectingInstallment(inst)}
                                  >
                                    Είσπραξη
                                  </Button>
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

                {isAdmin && (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Μεταφορά παραστατικού σε άλλο συμβόλαιο</span>
                      <Input
                        value={transferTarget}
                        onChange={(e) => setTransferTarget(e.target.value)}
                        placeholder="ID συμβολαίου-στόχου"
                        className="h-8 w-64 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!transferTarget || transferring}
                      onClick={async () => {
                        if (!movementId) return;
                        setTransferring(true);
                        setTransferError(null);
                        const result = await transferMovement(movementId, transferTarget);
                        setTransferring(false);
                        if (result?.error) {
                          setTransferError(result.error);
                          return;
                        }
                        onChanged?.();
                        onOpenChange(false);
                      }}
                    >
                      Μεταφορά
                    </Button>
                    {transferError && <p className="text-xs text-destructive">{transferError}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/policies/${policyId}`}>Άνοιγμα πλήρους σελίδας</Link>}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CollectPaymentDialog
        documentLabel={movementSummary?.documentNumber ?? null}
        kindLabel={movementSummary?.kindLabel ?? null}
        installment={collectingInstallment}
        open={collectingInstallment !== null}
        onOpenChange={(open) => {
          if (!open) setCollectingInstallment(null);
        }}
        paymentMethods={data?.paymentMethods ?? []}
        collectAction={async (installmentId, formData) => {
          await collectInstallmentPayment(policyId, installmentId, formData);
          await refetch();
          onChanged?.();
        }}
      />
    </>
  );
}
