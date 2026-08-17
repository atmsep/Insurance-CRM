"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/date";
import { getPolicyMovements, type MovementRow } from "../../movements-actions";
import { MovementReceiptDialog } from "./movement-receipt-dialog";
import { NewMovementDialog } from "./new-movement-dialog";

export function MovementsTab({ policyId, isAdmin }: { policyId: string; isAdmin: boolean }) {
  const [movements, setMovements] = useState<MovementRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [creatingMovement, setCreatingMovement] = useState(false);

  async function refetch() {
    try {
      setLoadError(false);
      setMovements(await getPolicyMovements(policyId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getPolicyMovements(policyId)
      .then((result) => {
        if (!cancelled) setMovements(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  const totalOutstanding = movements?.reduce((sum, m) => sum + m.outstanding, 0) ?? 0;
  const selectedMovement = movements?.find((m) => m.id === selectedMovementId) ?? null;

  // The MOST RECENT policy/renewal movement isn't necessarily the term
  // that's actually active right now — a renewal can be created ahead of
  // its own start date, so "latest by created_at" can point at a future
  // term while an earlier one is still the one in effect today. Ν Κίνηση
  // resolves the right term itself (by whichever span actually contains
  // the date being entered), so it just needs every term and every
  // endorsement, not one pre-picked "current" one.
  const termMovements = useMemo(
    () =>
      (movements ?? [])
        .filter((m) => m.kind === "policy" || m.kind === "renewal")
        .map((m) => ({
          startDate: m.startDate,
          endDate: m.endDate,
          premiumNet: m.premiumNet,
          premiumGross: m.premiumGross,
        })),
    [movements],
  );
  const endorsementMovements = useMemo(
    () =>
      (movements ?? [])
        .filter((m) => m.kind === "endorsement")
        .map((m) => ({
          startDate: m.startDate,
          endDate: m.endDate,
          premiumNet: m.premiumNet,
          premiumGross: m.premiumGross,
        })),
    [movements],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Κινήσεις</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError ? (
            <div className="flex flex-col items-start gap-2 text-sm">
              <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των κινήσεων.</p>
              <Button type="button" variant="outline" size="sm" onClick={refetch}>
                Δοκίμασε ξανά
              </Button>
            </div>
          ) : !movements ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ημ. παραγωγής</TableHead>
                    <TableHead>Είδος</TableHead>
                    <TableHead>Παραστατικό</TableHead>
                    <TableHead>Συνεργάτης</TableHead>
                    <TableHead>Έναρξη</TableHead>
                    <TableHead>Λήξη</TableHead>
                    <TableHead>Καθ. ασφ.</TableHead>
                    <TableHead>Μικτά ασφ.</TableHead>
                    <TableHead>Υπόλοιπο</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length ? (
                    movements.map((m) => (
                      <TableRow
                        key={m.id}
                        onDoubleClick={() => m.isReal && setSelectedMovementId(m.id)}
                        className={m.isReal ? "cursor-pointer hover:bg-muted/50" : "text-muted-foreground"}
                        title={m.isReal ? undefined : "Ιστορική περίοδος πριν την αναβάθμιση — μόνο για προβολή."}
                      >
                        <TableCell>{formatDate(m.producedAt)}</TableCell>
                        <TableCell>{m.kindLabel}</TableCell>
                        <TableCell className="font-medium">{m.documentNumber ?? "—"}</TableCell>
                        <TableCell>{m.agentName ?? "—"}</TableCell>
                        <TableCell>{formatDate(m.startDate)}</TableCell>
                        <TableCell>{formatDate(m.endDate)}</TableCell>
                        <TableCell>{m.premiumNet != null ? `${m.premiumNet.toFixed(2)} €` : "—"}</TableCell>
                        <TableCell>{m.premiumGross.toFixed(2)} €</TableCell>
                        <TableCell>{m.outstanding.toFixed(2)} €</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Δεν υπάρχουν κινήσεις.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Σύνολο ανεισπράκτων:{" "}
                  <span className="font-medium text-foreground">{totalOutstanding.toFixed(2)} €</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!movements.some((m) => m.isReal)}
                    onClick={() => {
                      const latestReal = [...movements].reverse().find((m) => m.isReal);
                      if (latestReal) setSelectedMovementId(latestReal.id);
                    }}
                  >
                    Είσπραξη
                  </Button>
                  <Button type="button" size="sm" onClick={() => setCreatingMovement(true)}>
                    Νέα Κίνηση
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MovementReceiptDialog
        key={selectedMovementId ?? "none"}
        movementId={selectedMovementId}
        movementSummary={selectedMovement}
        open={selectedMovementId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMovementId(null);
        }}
        isAdmin={isAdmin}
        policyId={policyId}
        onChanged={refetch}
      />

      <NewMovementDialog
        key={creatingMovement ? "open" : "closed"}
        policyId={policyId}
        open={creatingMovement}
        onOpenChange={setCreatingMovement}
        onCreated={refetch}
        termMovements={termMovements}
        endorsementMovements={endorsementMovements}
      />
    </>
  );
}
