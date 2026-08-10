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
import { formatDate } from "@/lib/date";
import { ReferralRewardForm } from "./referral-reward-form";
import { updateReferralReward } from "../../actions";

export type ReferredClient = {
  id: string;
  client_code: number;
  client_type: string;
  is_active: boolean;
  created_at: string;
  referral_reward_amount: number | null;
  referral_reward_status: string | null;
  referral_reward_notes: string | null;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
};

// Affiliate-style view of everyone this client has referred — the reverse of
// the "Συστήνων" field on the Details tab, which only shows who referred
// THIS client. Rewards are edited from here since this is where the
// affiliate relationship is actually managed, even though the reward
// columns live on the referred client's own row.
export function ReferralsTab({
  referrerClientId,
  referrals,
}: {
  referrerClientId: string;
  referrals: ReferredClient[];
}) {
  const totalPending = referrals
    .filter((r) => r.referral_reward_status === "pending")
    .reduce((sum, r) => sum + (r.referral_reward_amount ?? 0), 0);
  const totalPaid = referrals
    .filter((r) => r.referral_reward_status === "paid")
    .reduce((sum, r) => sum + (r.referral_reward_amount ?? 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Συστάσεις</CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            Σύνολο: <span className="font-medium text-foreground">{referrals.length}</span>
          </span>
          <span>
            Εκκρεμεί: <span className="font-medium text-foreground">{totalPending.toFixed(2)} €</span>
          </span>
          <span>
            Πληρώθηκε: <span className="font-medium text-foreground">{totalPaid.toFixed(2)} €</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Κωδ.</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Ημ. εγγραφής</TableHead>
              <TableHead>Κατάσταση πελάτη</TableHead>
              <TableHead>Ανταπόδοση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.length ? (
              referrals.map((r) => {
                const name = resolveClientName(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">#{r.client_code}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/clients/${r.id}`} className="hover:underline">
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "success" : "outline"}>
                        {r.is_active ? "Ενεργός" : "Ανενεργός"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ReferralRewardForm
                        amount={r.referral_reward_amount}
                        status={r.referral_reward_status}
                        notes={r.referral_reward_notes}
                        rewardAction={updateReferralReward.bind(null, referrerClientId, r.id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Ο πελάτης δεν έχει συστήσει κανέναν ακόμα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
