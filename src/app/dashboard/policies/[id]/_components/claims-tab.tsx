"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { claimStatusVariant } from "@/lib/status-badge";
import { getPolicyClaims } from "../../actions";

const CLAIM_STATUS_LABELS: Record<string, string> = {
  reported: "Αναφέρθηκε",
  under_review: "Υπό εξέταση",
  approved: "Εγκρίθηκε",
  rejected: "Απορρίφθηκε",
  paid: "Πληρώθηκε",
  closed: "Έκλεισε",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

type Claim = {
  id: string;
  claim_number: string | null;
  status: string;
  date_of_loss: string;
  claim_amount_estimated: number | null;
};

export function ClaimsTab({ policyId }: { policyId: string }) {
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    getPolicyClaims(policyId).then(setClaims);
  }, [policyId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ζημιές</CardTitle>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/dashboard/claims/new?policy_id=${policyId}`}>Νέα ζημιά</Link>}
        />
      </CardHeader>
      <CardContent>
        {!claims ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Αριθμός</TableHead>
                <TableHead>Ημ. ζημιάς</TableHead>
                <TableHead>Εκτιμώμενο ποσό</TableHead>
                <TableHead>Κατάσταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length ? (
                claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline">
                        {claim.claim_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(claim.date_of_loss)}</TableCell>
                    <TableCell>
                      {claim.claim_amount_estimated != null ? `${claim.claim_amount_estimated} €` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={claimStatusVariant(claim.status)}>
                        {CLAIM_STATUS_LABELS[claim.status] ?? claim.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Δεν υπάρχουν ζημιές.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
