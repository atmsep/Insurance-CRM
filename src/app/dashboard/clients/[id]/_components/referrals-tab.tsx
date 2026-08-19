"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "./column-filter";
import { resolveClientName } from "@/lib/client-name";
import { policyStatusVariant } from "@/lib/status-badge";
import { POLICY_STATUS_LABELS } from "../../../policies/policy-labels";
import { ReferralRewardForm } from "./referral-reward-form";
import { DefaultRewardRuleDialog } from "./default-reward-rule-dialog";
import { saveReferralReward, setDefaultReferralRewardRule } from "../../referral-reward-actions";
import type { ReferredPolicy, ReferredClient } from "./referrals-data";

export type { ReferredPolicy, ReferredClient } from "./referrals-data";

type Column = {
  key: string;
  label: string;
  getValue: (p: ReferredPolicy) => string;
  getSortKey: (p: ReferredPolicy) => string | number;
};

const COLUMNS: Column[] = [
  { key: "policy_number", label: "Συμβόλαιο", getValue: (p) => p.policy_number, getSortKey: (p) => p.policy_number },
  {
    key: "premium_net",
    label: "Καθαρό ασφάλιστρο",
    getValue: (p) => (p.premium_net != null ? `${p.premium_net.toFixed(2)} €` : "—"),
    getSortKey: (p) => p.premium_net ?? 0,
  },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (p) => POLICY_STATUS_LABELS[p.status] ?? p.status,
    getSortKey: (p) => POLICY_STATUS_LABELS[p.status] ?? p.status,
  },
  {
    key: "reward",
    label: "Ανταπόδοση",
    getValue: (p) =>
      p.referral_rewards ? `${p.referral_rewards.reward_amount.toFixed(2)} €` : "—",
    getSortKey: (p) => p.referral_rewards?.reward_amount ?? 0,
  },
];

// Each referred client gets its own independent filter/sort state — these
// are separate small tables, not one flat list, so there's no shared state
// to lift into the parent.
function ReferredClientCard({
  referrerClientId,
  client,
}: {
  referrerClientId: string;
  client: ReferredClient;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const name = resolveClientName(client);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const p of client.policies) {
        const value = col.getValue(p);
        if (!seen.has(value)) seen.set(value, col.getSortKey(p));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [client.policies]);

  const visiblePolicies = useMemo(() => {
    const filtered = client.policies.filter((p) =>
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
  }, [client.policies, filters, sort]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
            #{client.client_code} {name}
          </Link>
        </CardTitle>
        <Badge variant={client.is_active ? "success" : "outline"}>
          {client.is_active ? "Ενεργός" : "Ανενεργός"}
        </Badge>
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
              visiblePolicies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/dashboard/policies/${p.policyId}`} className="hover:underline">
                      {p.policy_number}
                    </Link>
                    {p.movementId
                      ? p.periodLabel && (
                          <Badge variant="outline" className="ml-2">
                            {p.periodLabel}
                          </Badge>
                        )
                      : p.renewal_number > 1 && (
                          <Badge variant="outline" className="ml-2">
                            Ανανέωση #{p.renewal_number}
                          </Badge>
                        )}
                  </TableCell>
                  <TableCell>{p.premium_net != null ? `${p.premium_net.toFixed(2)} €` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={policyStatusVariant(p.status)}>
                      {POLICY_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ReferralRewardForm
                      premiumNet={p.premium_net}
                      reward={p.referral_rewards}
                      rewardAction={saveReferralReward.bind(null, referrerClientId, client.id, p.policyId, p.movementId)}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {client.policies.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν έχει συμβόλαια ακόμα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Affiliate-style view of everyone this client has referred — the reverse of
// the "Συστήνων" field on the Details tab, which only shows who referred
// THIS client. Rewards are configured per POLICY of the referred client
// (including every renewal term separately), edited from here since this is
// where the affiliate relationship is actually managed, even though the
// reward rows are keyed to the referred client's own policies.
export function ReferralsTab({
  referrerClientId,
  referrals,
  isAdmin,
  defaultRule,
}: {
  referrerClientId: string;
  referrals: ReferredClient[];
  isAdmin: boolean;
  defaultRule: { calc_type: "percent" | "fixed"; rate_percent: number | null; fixed_amount: number | null } | null;
}) {
  const allRewards = referrals.flatMap((r) => r.policies.map((p) => p.referral_rewards).filter((r) => r != null));
  const totalPending = allRewards
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.reward_amount, 0);
  const totalPaid = allRewards.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.reward_amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Συστάσεις</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              Πελάτες: <span className="font-medium text-foreground">{referrals.length}</span>
            </span>
            <span>
              Εκκρεμεί: <span className="font-medium text-foreground">{totalPending.toFixed(2)} €</span>
            </span>
            <span>
              Πληρώθηκε: <span className="font-medium text-foreground">{totalPaid.toFixed(2)} €</span>
            </span>
          </div>
          {isAdmin && (
            <DefaultRewardRuleDialog
              currentRule={defaultRule}
              applyAction={setDefaultReferralRewardRule.bind(null, referrerClientId)}
            />
          )}
        </div>
      </div>

      {referrals.length ? (
        referrals.map((r) => (
          <ReferredClientCard key={r.id} referrerClientId={referrerClientId} client={r} />
        ))
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Ο πελάτης δεν έχει συστήσει κανέναν ακόμα.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
