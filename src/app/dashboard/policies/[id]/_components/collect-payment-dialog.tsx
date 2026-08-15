"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/date";
import { installmentRemaining } from "../../balance";
import type { InstallmentWithPayments, PolicyMovement } from "../../actions";
import { CollectPaymentForm } from "../../collect-payment-form";

export function CollectPaymentDialog({
  movement,
  installment,
  open,
  onOpenChange,
  collectAction,
  paymentMethods,
}: {
  movement: PolicyMovement | null;
  installment: InstallmentWithPayments | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectAction: (installmentId: string, formData: FormData) => Promise<void>;
  paymentMethods: { id: string; name: string }[];
}) {
  const remaining = installment ? installmentRemaining(installment) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Καταχώρηση είσπραξης</DialogTitle>
        </DialogHeader>

        {movement && installment && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
              <h3 className="text-sm font-medium">Παραστατικό</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Συμβόλαιο</span>
                  <span>{movement.document_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Είδος</span>
                  <span>{movement.kind}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Δόση #{installment.installment_number}</span>
                  <span>{formatDate(installment.due_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ασφάλιστρα δόσης</span>
                  <span>{installment.amount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ήδη καταβλήθηκαν</span>
                  <span>{(installment.paid_amount ?? 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Υπόλοιπο</span>
                  <span>{remaining.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Είσπραξη</h3>
              <CollectPaymentForm
                embedded
                installmentId={installment.id}
                collectAction={async (formData) => {
                  await collectAction(installment.id, formData);
                  onOpenChange(false);
                }}
                amount={installment.amount}
                alreadyPaid={installment.paid_amount ?? 0}
                paymentMethods={paymentMethods}
                onCancel={() => onOpenChange(false)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
