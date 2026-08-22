"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openReceiptWindowDeferred } from "./open-receipt";

// Η μεμονωμένη απόδοση ήταν σκέτο <form action> — έγινε client κουμπί ώστε
// μετά την επιτυχία να ανοίγει το έντυπο απόδειξης, όπως κάνει και η
// μαζική. Το έντυπο ανοίγει σε ΞΕΧΩΡΙΣΤΟ παράθυρο (όχι καρτέλα), ώστε η
// λίστα να μένει εκεί που την άφησε ο χρήστης· και μόνο αν πέτυχε η
// ενέργεια — απόδειξη για απόδοση που δεν έγινε είναι χειρότερη από
// καθόλου απόδειξη.
export function RemitRowButton({
  movementId,
  action,
  receiptHref,
}: {
  movementId: string;
  action: (movementId: string) => Promise<void>;
  receiptHref: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        const receipt = openReceiptWindowDeferred();
        startTransition(async () => {
          try {
            await action(movementId);
            receipt.fill(receiptHref);
          } catch {
            receipt.abort();
            toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
          }
        });
      }}
    >
      Απόδοση
    </Button>
  );
}
