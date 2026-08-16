"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/clickable-row";
import { policyStatusVariant } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";
import { POLICY_STATUS_LABELS } from "../../../policies/policy-labels";
import { ColumnFilter, type FilterOption, type SortDirection } from "./column-filter";

export type Policy = {
  id: string;
  policy_number: string;
  status: string;
  start_date: string;
  end_date: string;
  premium_gross: number;
  renewal_number: number;
  risk_label: string | null;
  insurance_lines: { name_el: string } | null;
  carriers: { name: string } | null;
};

function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  return Math.max(months, 0);
}

function formatDuration(start: string, end: string): string {
  const months = monthsBetween(start, end);
  return months === 1 ? "1 μήνας" : `${months} μήνες`;
}

type Column = {
  key: string;
  label: string;
  getValue: (p: Policy) => string;
  getSortKey: (p: Policy) => string | number;
};

const COLUMNS: Column[] = [
  { key: "policy_number", label: "Αριθμός", getValue: (p) => p.policy_number, getSortKey: (p) => p.policy_number },
  {
    key: "carrier",
    label: "Εταιρεία",
    getValue: (p) => p.carriers?.name ?? "—",
    getSortKey: (p) => p.carriers?.name ?? "",
  },
  {
    key: "line",
    label: "Κλάδος",
    getValue: (p) => p.insurance_lines?.name_el ?? "—",
    getSortKey: (p) => p.insurance_lines?.name_el ?? "",
  },
  {
    key: "risk_label",
    label: "Χαρακτηριστικό",
    getValue: (p) => p.risk_label ?? "—",
    getSortKey: (p) => p.risk_label ?? "",
  },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (p) => POLICY_STATUS_LABELS[p.status] ?? p.status,
    getSortKey: (p) => POLICY_STATUS_LABELS[p.status] ?? p.status,
  },
  {
    key: "start_date",
    label: "Ημ. Έναρξης",
    getValue: (p) => formatDate(p.start_date),
    getSortKey: (p) => p.start_date,
  },
  { key: "end_date", label: "Λήξη", getValue: (p) => formatDate(p.end_date), getSortKey: (p) => p.end_date },
  {
    key: "duration",
    label: "Διάρκεια",
    getValue: (p) => formatDuration(p.start_date, p.end_date),
    getSortKey: (p) => monthsBetween(p.start_date, p.end_date),
  },
  {
    key: "premium",
    label: "Ασφάλιστρο",
    getValue: (p) => `${p.premium_gross.toFixed(2)} €`,
    getSortKey: (p) => p.premium_gross,
  },
];

export function PoliciesTab({ policies }: { policies: Policy[] }) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, FilterOption[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const p of policies) {
        const value = col.getValue(p);
        if (!seen.has(value)) seen.set(value, col.getSortKey(p));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [policies]);

  const visiblePolicies = useMemo(() => {
    const filtered = policies.filter((p) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(p));
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
  }, [policies, filters, sort]);

  const hasActiveFilters = Object.values(filters).some((f) => f !== null && f !== undefined);
  const hasActiveSortOrFilters = hasActiveFilters || sort !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Συμβόλαια</CardTitle>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground">
              Εμφανίζονται {visiblePolicies.length} από {policies.length}
            </span>
          )}
          {hasActiveSortOrFilters && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setFilters({});
                setSort(null);
              }}
            >
              Καθαρισμός φίλτρων
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
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
            {visiblePolicies.length ? (
              visiblePolicies.map((policy) => (
                <ClickableRow key={policy.id} href={`/dashboard/policies/${policy.id}`}>
                  <TableCell>
                    <Link href={`/dashboard/policies/${policy.id}`} className="hover:underline">
                      {policy.policy_number}
                    </Link>
                    {policy.renewal_number > 1 && (
                      <Badge variant="outline" className="ml-2">
                        Ανανέωση #{policy.renewal_number}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{policy.carriers?.name ?? "—"}</TableCell>
                  <TableCell>{policy.insurance_lines?.name_el ?? "—"}</TableCell>
                  <TableCell>{policy.risk_label ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={policyStatusVariant(policy.status)}>
                      {POLICY_STATUS_LABELS[policy.status] ?? policy.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(policy.start_date)}</TableCell>
                  <TableCell>{formatDate(policy.end_date)}</TableCell>
                  <TableCell>{formatDuration(policy.start_date, policy.end_date)}</TableCell>
                  <TableCell>{policy.premium_gross.toFixed(2)} €</TableCell>
                </ClickableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="text-center text-muted-foreground">
                  {policies.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν συμβόλαια ακόμα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
