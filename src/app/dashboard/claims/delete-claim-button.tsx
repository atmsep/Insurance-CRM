"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteClaim } from "./actions";

export function DeleteClaimButton({ claimId, policyId }: { claimId: string; policyId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        if (!window.confirm("Οριστική διαγραφή της ζημιάς;")) return;
        startTransition(async () => {
          const result = await deleteClaim(claimId, policyId);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      Διαγραφή
    </Button>
  );
}
