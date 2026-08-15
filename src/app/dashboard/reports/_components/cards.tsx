import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBillingSummary,
  getClaimsByStatus,
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

// One boundary for the whole stat row: it draws from 2 different RPCs
// (policies-by-status, billing), each already deduped via the
// cache()-wrapped getters against the table cards below that use the same
// data — splitting the row itself into 5 tiny boundaries wouldn't reduce
// any DB round-trips, only add layout churn.
export async function ReportsStatsRow() {
  const [policiesByStatusRows, billing] = await Promise.all([getPoliciesByStatus(), getBillingSummary()]);

  const activePremium = policiesByStatusRows.find((r) => r.status === "active")?.premium_sum ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Ενεργό ασφάλιστρο" value={`${activePremium.toFixed(2)} €`} />
      <StatCard label="Χρεωθέν σύνολο εισπράξεων" value={`${billing.total_billed.toFixed(2)} €`} />
      <StatCard label="Εισπραγμένο" value={`${billing.total_collected.toFixed(2)} €`} />
      <StatCard label="Φιλοδωρήματα" value={`${billing.total_tips.toFixed(2)} €`} />
      <StatCard
        label="Ανείσπρακτο υπόλοιπο"
        value={`${billing.outstanding.toFixed(2)} €`}
        tone={billing.outstanding > 0 ? "warning" : "neutral"}
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

