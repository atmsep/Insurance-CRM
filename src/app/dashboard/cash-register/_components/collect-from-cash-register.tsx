"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CollectPaymentDialog } from "../../policies/[id]/_components/collect-payment-dialog";
import { collectInstallmentPayment } from "../../policies/movements-actions";

type Installment = {
  id: string;
  installmentNumber: number;
  dueDate: string;
  paidDate: string | null;
  amount: number;
  paidAmount: number | null;
  status: string;
};

export function CollectFromCashRegister({
  policyId,
  documentLabel,
  kindLabel,
  installments,
  paymentMethods,
}: {
  policyId: string;
  documentLabel: string;
  kindLabel: string | null;
  installments: Installment[];
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Installment | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {installments.map((inst) => (
        <Button key={inst.id} type="button" size="xs" variant="outline" onClick={() => setTarget(inst)}>
          {installments.length > 1 ? `Είσπραξη #${inst.installmentNumber}` : "Είσπραξη"}
        </Button>
      ))}
      <CollectPaymentDialog
        documentLabel={documentLabel}
        kindLabel={kindLabel}
        installment={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        collectAction={async (installmentId, formData) => {
          await collectInstallmentPayment(policyId, installmentId, formData);
          setTarget(null);
          router.refresh();
        }}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
