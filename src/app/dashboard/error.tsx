"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logClientError } from "@/lib/actions/log-client-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError(error.message, error.digest, window.location.href).catch(() => {
      // Nothing more we can do if even the log call fails.
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Κάτι πήγε στραβά</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Σημειώσαμε το σφάλμα. Δοκίμασε ξανά — αν συνεχίσει να εμφανίζεται, ενημέρωσε τον
        διαχειριστή του συστήματος.
      </p>
      <Button onClick={() => reset()}>Δοκίμασε ξανά</Button>
    </div>
  );
}
