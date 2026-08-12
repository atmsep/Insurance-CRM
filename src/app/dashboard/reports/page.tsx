import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMMISSION_DIRECTION_LABELS } from "../commissions/direction-labels";

const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  reported: "Αναφέρθηκε",
  under_review: "Υπό εξέταση",
  approved: "Εγκρίθηκε",
  rejected: "Απορρίφθηκε",
  paid: "Πληρώθηκε",
  closed: "Έκλεισε",
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  invoiced: "Τιμολογήθηκε",
  paid: "Πληρώθηκε",
  cancelled: "Ακυρώθηκε",
};

// Shapes returned by the report_* SQL functions (migration 0055) — not in
// database.types.ts, which doesn't model custom functions, so the RPC calls
// below need an explicit generic instead of relying on inference.
type PoliciesByStatusRow = { status: string; policy_count: number; premium_sum: number };
type PoliciesByLineRow = { line_name: string; policy_count: number; premium_sum: number };
type BillingSummaryRow = {
  total_billed: number;
  total_collected: number;
  total_tips: number;
  outstanding: number;
};
type ClaimsByStatusRow = { status: string; claim_count: number; amount_sum: number };
type CommissionsByStatusRow = {
  direction: "incoming" | "outgoing";
  status: string;
  commission_count: number;
  amount_sum: number;
};
type ReferralBreakdownRow = { source: string; client_count: number };
type CarrierSummaryRow = {
  carrier_id: string;
  carrier_name: string;
  collected: number;
  commission_total: number;
  commission_pending: number;
};

export default async function ReportsPage() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Every one of these tables can now hold well over Supabase's default
  // 1000-row page cap (the Profia import alone put policies/installments/
  // commissions far past it), and paging through the biggest ones client-side
  // was itself slow enough to hit the statement timeout — so the aggregation
  // happens in Postgres (see migration 0055) and each call here returns a
  // handful of rows regardless of table size.
  const [
    { data: policiesByStatusRows },
    { data: lineBreakdownRows },
    { data: billing },
    { data: claimsByStatusRows },
    { data: commissionsByStatusRows },
    { data: referralRows },
    { data: carrierRows },
  ] = (await Promise.all([
    supabase.rpc("report_policies_by_status"),
    supabase.rpc("report_policies_by_line"),
    supabase.rpc("report_billing_summary"),
    supabase.rpc("report_claims_by_status"),
    supabase.rpc("report_commissions_by_status"),
    supabase.rpc("report_referral_breakdown"),
    supabase.rpc("report_carrier_summary"),
  ])) as unknown as [
    { data: PoliciesByStatusRow[] | null },
    { data: PoliciesByLineRow[] | null },
    { data: BillingSummaryRow[] | null },
    { data: ClaimsByStatusRow[] | null },
    { data: CommissionsByStatusRow[] | null },
    { data: ReferralBreakdownRow[] | null },
    { data: CarrierSummaryRow[] | null },
  ];

  const policiesByStatus = new Map(
    (policiesByStatusRows ?? []).map((r) => [r.status, { count: r.policy_count, total: r.premium_sum }]),
  );
  const activePremium = policiesByStatus.get("active")?.total ?? 0;

  const lineBreakdown = new Map(
    (lineBreakdownRows ?? []).map((r) => [r.line_name, { count: r.policy_count, total: r.premium_sum }]),
  );

  const totalBilled = billing?.[0]?.total_billed ?? 0;
  const totalCollected = billing?.[0]?.total_collected ?? 0;
  const totalTips = billing?.[0]?.total_tips ?? 0;
  const outstanding = billing?.[0]?.outstanding ?? 0;

  const claimsByStatus = new Map(
    (claimsByStatusRows ?? []).map((r) => [r.status, { count: r.claim_count, total: r.amount_sum }]),
  );

  const incomingByStatus = new Map(
    (commissionsByStatusRows ?? [])
      .filter((r) => r.direction === "incoming")
      .map((r) => [r.status, { count: r.commission_count, total: r.amount_sum }]),
  );
  const outgoingByStatus = new Map(
    (commissionsByStatusRows ?? [])
      .filter((r) => r.direction === "outgoing")
      .map((r) => [r.status, { count: r.commission_count, total: r.amount_sum }]),
  );
  const totalIncomingCommissions = [...incomingByStatus.values()].reduce((sum, e) => sum + e.total, 0);
  const totalOutgoingCommissions = [...outgoingByStatus.values()].reduce((sum, e) => sum + e.total, 0);
  const netCommissions = totalIncomingCommissions - totalOutgoingCommissions;

  const referralBreakdown = new Map(
    (referralRows ?? []).map((r) => [r.source, { count: r.client_count }]),
  );

  const carrierMap = new Map(
    (carrierRows ?? []).map((r) => [
      r.carrier_id,
      {
        name: r.carrier_name,
        collected: r.collected,
        commissionTotal: r.commission_total,
        commissionPending: r.commission_pending,
      },
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Αναφορές</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Ενεργό ασφάλιστρο" value={`${activePremium.toFixed(2)} €`} />
        <StatCard label="Χρεωθέν σύνολο εισπράξεων" value={`${totalBilled.toFixed(2)} €`} />
        <StatCard label="Εισπραγμένο" value={`${totalCollected.toFixed(2)} €`} />
        <StatCard label="Φιλοδωρήματα" value={`${totalTips.toFixed(2)} €`} />
        <StatCard
          label="Ανείσπρακτο υπόλοιπο"
          value={`${outstanding.toFixed(2)} €`}
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Καθαρές προμήθειες"
          value={`${netCommissions.toFixed(2)} €`}
          tone={netCommissions < 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Συμβόλαια ανά κατάσταση</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...policiesByStatus.entries()].map(([status, { count }]) => (
                  <TableRow key={status}>
                    <TableCell>{POLICY_STATUS_LABELS[status] ?? status}</TableCell>
                    <TableCell>{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ασφάλιστρο ανά κλάδο</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κλάδος</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Σύνολο ασφαλίστρου</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...lineBreakdown.entries()].map(([line, { count, total }]) => (
                  <TableRow key={line}>
                    <TableCell>{line}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>{total.toFixed(2)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ζημιές ανά κατάσταση</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Ποσό</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimsByStatus.size ? (
                  [...claimsByStatus.entries()].map(([status, { count, total }]) => (
                    <TableRow key={status}>
                      <TableCell>{CLAIM_STATUS_LABELS[status] ?? status}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{total.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Δεν υπάρχουν ζημιές.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {COMMISSION_DIRECTION_LABELS.incoming} προμήθειες ανά κατάσταση — σύνολο{" "}
              {totalIncomingCommissions.toFixed(2)} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Ποσό</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomingByStatus.size ? (
                  [...incomingByStatus.entries()].map(([status, { count, total }]) => (
                    <TableRow key={status}>
                      <TableCell>{COMMISSION_STATUS_LABELS[status] ?? status}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{total.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Δεν υπάρχουν εισερχόμενες προμήθειες.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {COMMISSION_DIRECTION_LABELS.outgoing} προμήθειες ανά κατάσταση — σύνολο{" "}
              {totalOutgoingCommissions.toFixed(2)} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Ποσό</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outgoingByStatus.size ? (
                  [...outgoingByStatus.entries()].map(([status, { count, total }]) => (
                    <TableRow key={status}>
                      <TableCell>{COMMISSION_STATUS_LABELS[status] ?? status}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{total.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Δεν υπάρχουν εξερχόμενες προμήθειες.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Πελάτες ανά πηγή σύστασης</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πηγή</TableHead>
                  <TableHead>Πλήθος</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralBreakdown.size ? (
                  [...referralBreakdown.entries()]
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([source, { count }]) => (
                      <TableRow key={source}>
                        <TableCell>{source}</TableCell>
                        <TableCell>{count}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Δεν υπάρχουν πελάτες ακόμα.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Καρτέλα ανά ασφαλιστική εταιρεία</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              &quot;Οφειλή προς εταιρεία&quot; = εισπραγμένο ασφάλιστρο μείον το σύνολο των
              προμηθειών μας — ενδεικτικός υπολογισμός, όχι επίσημη λογιστική καρτέλα.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Εταιρεία</TableHead>
                  <TableHead>Εισπραγμένο ασφάλιστρο</TableHead>
                  <TableHead>Προμήθειά μας</TableHead>
                  <TableHead>Εκκρεμής προμήθεια (μας οφείλει)</TableHead>
                  <TableHead>Οφειλή προς εταιρεία (εκτίμηση)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carrierMap.size ? (
                  [...carrierMap.entries()].map(([carrierId, agg]) => (
                    <TableRow key={carrierId}>
                      <TableCell>{agg.name}</TableCell>
                      <TableCell>{agg.collected.toFixed(2)} €</TableCell>
                      <TableCell>{agg.commissionTotal.toFixed(2)} €</TableCell>
                      <TableCell>{agg.commissionPending.toFixed(2)} €</TableCell>
                      <TableCell>{(agg.collected - agg.commissionTotal).toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Δεν υπάρχουν δεδομένα ακόμα.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  const toneClass = tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
