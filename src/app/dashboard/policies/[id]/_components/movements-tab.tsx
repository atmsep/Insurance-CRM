"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { ClickableRow } from "@/components/clickable-row";
import { formatDate } from "@/lib/date";
import { getPolicyMovements, type PolicyMovement } from "../../actions";

export function MovementsTab({
  policyGroupId,
  currentPolicyId,
}: {
  policyGroupId: string;
  currentPolicyId: string;
}) {
  const [movements, setMovements] = useState<PolicyMovement[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function refetch() {
    try {
      setLoadError(false);
      setMovements(await getPolicyMovements(policyGroupId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getPolicyMovements(policyGroupId)
      .then((result) => {
        if (!cancelled) setMovements(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [policyGroupId]);

  const totalOutstanding = movements?.reduce((sum, m) => sum + m.outstanding, 0) ?? 0;
  const latestTermId = movements?.[movements.length - 1]?.id ?? currentPolicyId;

  return (
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
                    <ClickableRow
                      key={m.id}
                      href={`/dashboard/policies/${m.id}`}
                      className={m.id === currentPolicyId ? "bg-muted" : undefined}
                    >
                      <TableCell>{formatDate(m.created_at)}</TableCell>
                      <TableCell>{m.kind}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/policies/${m.id}`} className="hover:underline">
                          {m.document_label}
                        </Link>
                      </TableCell>
                      <TableCell>{m.agent_name ?? "—"}</TableCell>
                      <TableCell>{formatDate(m.start_date)}</TableCell>
                      <TableCell>{formatDate(m.end_date)}</TableCell>
                      <TableCell>{m.premium_net != null ? `${m.premium_net.toFixed(2)} €` : "—"}</TableCell>
                      <TableCell>{m.premium_gross.toFixed(2)} €</TableCell>
                      <TableCell>{m.outstanding.toFixed(2)} €</TableCell>
                    </ClickableRow>
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
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/dashboard/policies/${latestTermId}`}>Είσπραξη</Link>}
                />
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/dashboard/policies/new?renew_from=${latestTermId}`}>Νέα Κίνηση</Link>}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
