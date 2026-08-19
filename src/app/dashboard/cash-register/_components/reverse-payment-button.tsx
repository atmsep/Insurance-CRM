"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reverseInstallmentPayment } from "../actions";

export function ReversePaymentButton({ paymentId, amountLabel }: { paymentId: string; amountLabel: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        const reason = window.prompt(`Ακύρωση είσπραξης ${amountLabel}; Γράψε την αιτιολογία:`);
        if (reason === null) return;
        startTransition(async () => {
          const result = await reverseInstallmentPayment(paymentId, reason);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Η είσπραξη ακυρώθηκε.");
          }
        });
      }}
    >
      Ακύρωση
    </Button>
  );
}
