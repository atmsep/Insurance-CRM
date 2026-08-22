"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Η μεμονωμένη απόδοση ήταν σκέτο <form action> — έγινε client κουμπί ώστε
// μετά την επιτυχία να ανοίγει το έντυπο απόδειξης σε νέα καρτέλα, όπως
// κάνει και η μαζική. Το άνοιγμα γίνεται ΜΟΝΟ αν πέτυχε η ενέργεια: μια
// απόδειξη για απόδοση που δεν έγινε είναι χειρότερη από καθόλου απόδειξη.
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
      onClick={() =>
        startTransition(async () => {
          try {
            await action(movementId);
            window.open(receiptHref, "_blank");
          } catch {
            toast.error("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
          }
        })
      }
    >
      Απόδοση
    </Button>
  );
}
