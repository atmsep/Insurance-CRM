"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ColumnFilter, type SortDirection } from "../../../clients/[id]/_components/column-filter";
import { claimStatusVariant } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";
import { getPolicyClaims } from "../../actions";
import { CLAIM_STATUS_LABELS } from "../../../claims/claim-labels";

type Claim = {
  id: string;
  claim_number: string | null;
  file_number: string | null;
  injured_party_name: string | null;
  status: string;
  date_of_loss: string;
  claim_amount_estimated: number | null;
};

type Column = {
  key: string;
  label: string;
  getValue: (c: Claim) => string;
  getSortKey: (c: Claim) => string | number;
};

const COLUMNS: Column[] = [
  { key: "claim_number", label: "Αριθμός", getValue: (c) => c.claim_number ?? "—", getSortKey: (c) => c.claim_number ?? "" },
  { key: "file_number", label: "Αρ. φακέλου", getValue: (c) => c.file_number ?? "—", getSortKey: (c) => c.file_number ?? "" },
  {
    key: "injured_party_name",
    label: "Παθών",
    getValue: (c) => c.injured_party_name ?? "—",
    getSortKey: (c) => c.injured_party_name ?? "",
  },
  { key: "date_of_loss", label: "Ημ. ζημιάς", getValue: (c) => formatDate(c.date_of_loss), getSortKey: (c) => c.date_of_loss },
  {
    key: "claim_amount_estimated",
    label: "Εκτιμώμενο ποσό",
    getValue: (c) => (c.claim_amount_estimated != null ? `${c.claim_amount_estimated} €` : "—"),
    getSortKey: (c) => c.claim_amount_estimated ?? 0,
  },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (c) => CLAIM_STATUS_LABELS[c.status] ?? c.status,
    getSortKey: (c) => CLAIM_STATUS_LABELS[c.status] ?? c.status,
  },
];

export function ClaimsTab({ policyId }: { policyId: string }) {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const c of claims ?? []) {
        const value = col.getValue(c);
        if (!seen.has(value)) seen.set(value, col.getSortKey(c));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [claims]);

  const visibleClaims = useMemo(() => {
    const filtered = (claims ?? []).filter((c) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(c));
      }),
    );
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a);
      const kb = col.getSortKey(b);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [claims, filters, sort]);

  async function refetch() {
    try {
      setLoadError(false);
      setClaims(await getPolicyClaims(policyId));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getPolicyClaims(policyId)
      .then((result) => {
        if (!cancelled) setClaims(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
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
        {loadError ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-muted-foreground">Δεν ήταν δυνατή η φόρτωση των ζημιών.</p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              Δοκίμασε ξανά
            </Button>
          </div>
        ) : !claims ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>
                    <ColumnFilter
                      label={col.label}
                      options={optionsByColumn.get(col.key) ?? []}
                      active={filters[col.key] ?? null}
                      onChange={(next) => setFilters((f) => ({ ...f, [col.key]: next }))}
                      sortDirection={sort?.key === col.key ? sort.direction : null}
                      onSort={(direction) => setSort(direction ? { key: col.key, direction } : null)}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClaims.length ? (
                visibleClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline">
                        {claim.claim_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{claim.file_number ?? "—"}</TableCell>
                    <TableCell>{claim.injured_party_name ?? "—"}</TableCell>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {(claims ?? []).length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν ζημιές."}
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
