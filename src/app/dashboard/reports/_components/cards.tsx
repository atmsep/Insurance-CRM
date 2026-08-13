import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMMISSION_DIRECTION_LABELS } from "../../commissions/direction-labels";
import {
  getBillingSummary,
  getCarrierSummary,
  getClaimsByStatus,
  getCommissionsByStatus,
  getPoliciesByLine,
  getPoliciesByStatus,
  getReferralBreakdown,
} from "./data";

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

// One boundary for the whole stat row: it draws from 3 different RPCs
// (policies-by-status, billing, commissions-by-status), each already
// deduped via the cache()-wrapped getters against the table cards below
// that use the same data — splitting the row itself into 6 tiny boundaries
// wouldn't reduce any DB round-trips, only add layout churn.
export async function ReportsStatsRow() {
  const [policiesByStatusRows, billing, commissionsByStatusRows] = await Promise.all([
    getPoliciesByStatus(),
    getBillingSummary(),
    getCommissionsByStatus(),
  ]);

  const activePremium = policiesByStatusRows.find((r) => r.status === "active")?.premium_sum ?? 0;

  const totalIncoming = commissionsByStatusRows
    .filter((r) => r.direction === "incoming")
    .reduce((sum, r) => sum + r.amount_sum, 0);
  const totalOutgoing = commissionsByStatusRows
    .filter((r) => r.direction === "outgoing")
    .reduce((sum, r) => sum + r.amount_sum, 0);
  const netCommissions = totalIncoming - totalOutgoing;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="Ενεργό ασφάλιστρο" value={`${activePremium.toFixed(2)} €`} />
      <StatCard label="Χρεωθέν σύνολο εισπράξεων" value={`${billing.total_billed.toFixed(2)} €`} />
      <StatCard label="Εισπραγμένο" value={`${billing.total_collected.toFixed(2)} €`} />
      <StatCard label="Φιλοδωρήματα" value={`${billing.total_tips.toFixed(2)} €`} />
      <StatCard
        label="Ανείσπρακτο υπόλοιπο"
        value={`${billing.outstanding.toFixed(2)} €`}
        tone={billing.outstanding > 0 ? "warning" : "neutral"}
      />
      <StatCard
        label="Καθαρές προμήθειες"
        value={`${netCommissions.toFixed(2)} €`}
        tone={netCommissions < 0 ? "warning" : "neutral"}
      />
    </div>
  );
}

export async function PoliciesByStatusTable() {
  const rows = await getPoliciesByStatus();
  return (
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
            {rows.map((r) => (
              <TableRow key={r.status}>
                <TableCell>{POLICY_STATUS_LABELS[r.status] ?? r.status}</TableCell>
                <TableCell>{r.policy_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export async function PoliciesByLineTable() {
  const rows = await getPoliciesByLine();
  return (
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
            {rows.map((r) => (
              <TableRow key={r.line_name}>
                <TableCell>{r.line_name}</TableCell>
                <TableCell>{r.policy_count}</TableCell>
                <TableCell>{r.premium_sum.toFixed(2)} €</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export async function ClaimsByStatusTable() {
  const rows = await getClaimsByStatus();
  return (
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
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.status}>
                  <TableCell>{CLAIM_STATUS_LABELS[r.status] ?? r.status}</TableCell>
                  <TableCell>{r.claim_count}</TableCell>
                  <TableCell>{r.amount_sum.toFixed(2)} €</TableCell>
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
  );
}

function CommissionsDirectionTable({
  direction,
  rows,
}: {
  direction: "incoming" | "outgoing";
  rows: { status: string; commission_count: number; amount_sum: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.amount_sum, 0);
  const emptyLabel =
    direction === "incoming" ? "Δεν υπάρχουν εισερχόμενες προμήθειες." : "Δεν υπάρχουν εξερχόμενες προμήθειες.";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {COMMISSION_DIRECTION_LABELS[direction]} προμήθειες ανά κατάσταση — σύνολο {total.toFixed(2)} €
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
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.status}>
                  <TableCell>{COMMISSION_STATUS_LABELS[r.status] ?? r.status}</TableCell>
                  <TableCell>{r.commission_count}</TableCell>
                  <TableCell>{r.amount_sum.toFixed(2)} €</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export async function IncomingCommissionsTable() {
  const rows = (await getCommissionsByStatus()).filter((r) => r.direction === "incoming");
  return <CommissionsDirectionTable direction="incoming" rows={rows} />;
}

export async function OutgoingCommissionsTable() {
  const rows = (await getCommissionsByStatus()).filter((r) => r.direction === "outgoing");
  return <CommissionsDirectionTable direction="outgoing" rows={rows} />;
}

export async function ReferralBreakdownTable() {
  const rows = [...(await getReferralBreakdown())].sort((a, b) => b.client_count - a.client_count);
  return (
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
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.source}>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>{r.client_count}</TableCell>
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
  );
}

export async function CarrierSummaryTable() {
  const rows = await getCarrierSummary();
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Καρτέλα ανά ασφαλιστική εταιρεία</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          &quot;Οφειλή προς εταιρεία&quot; = εισπραγμένο ασφάλιστρο μείον το σύνολο των προμηθειών μας —
          ενδεικτικός υπολογισμός, όχι επίσημη λογιστική καρτέλα.
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
            {rows.length ? (
              rows.map((r) => (
                <TableRow key={r.carrier_id}>
                  <TableCell>{r.carrier_name}</TableCell>
                  <TableCell>{r.collected.toFixed(2)} €</TableCell>
                  <TableCell>{r.commission_total.toFixed(2)} €</TableCell>
                  <TableCell>{r.commission_pending.toFixed(2)} €</TableCell>
                  <TableCell>{(r.collected - r.commission_total).toFixed(2)} €</TableCell>
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
  );
}
