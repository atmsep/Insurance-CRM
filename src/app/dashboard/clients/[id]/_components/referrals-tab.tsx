import Link from "next/link";
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
import { resolveClientName } from "@/lib/client-name";
import { policyStatusVariant } from "@/lib/status-badge";
import { POLICY_STATUS_LABELS } from "../../../policies/policy-labels";
import { ReferralRewardForm } from "./referral-reward-form";
import { saveReferralReward } from "../../referral-reward-actions";

export type ReferredPolicy = {
  id: string;
  policy_number: string;
  status: string;
  premium_net: number | null;
  renewal_number: number;
  referral_rewards: {
    calc_type: "percent" | "fixed";
    rate_percent: number | null;
    fixed_amount: number | null;
    reward_amount: number;
    status: string;
    notes: string | null;
  } | null;
};

export type ReferredClient = {
  id: string;
  client_code: number;
  client_type: string;
  is_active: boolean;
  created_at: string;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
  policies: ReferredPolicy[];
};

// Affiliate-style view of everyone this client has referred — the reverse of
// the "Συστήνων" field on the Details tab, which only shows who referred
// THIS client. Rewards are configured per POLICY of the referred client
// (including every renewal term separately), edited from here since this is
// where the affiliate relationship is actually managed, even though the
// reward rows are keyed to the referred client's own policies.
export function ReferralsTab({
  referrerClientId,
  referrals,
}: {
  referrerClientId: string;
  referrals: ReferredClient[];
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
      </div>

      {referrals.length ? (
        referrals.map((r) => {
          const name = resolveClientName(r);
          return (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  <Link href={`/dashboard/clients/${r.id}`} className="hover:underline">
                    #{r.client_code} {name}
                  </Link>
                </CardTitle>
                <Badge variant={r.is_active ? "success" : "outline"}>
                  {r.is_active ? "Ενεργός" : "Ανενεργός"}
                </Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Συμβόλαιο</TableHead>
                      <TableHead>Καθαρό ασφάλιστρο</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead>Ανταπόδοση</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.policies.length ? (
                      r.policies.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link href={`/dashboard/policies/${p.id}`} className="hover:underline">
                              {p.policy_number}
                            </Link>
                            {p.renewal_number > 1 && (
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
                              rewardAction={saveReferralReward.bind(null, referrerClientId, r.id, p.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Δεν έχει συμβόλαια ακόμα.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
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
