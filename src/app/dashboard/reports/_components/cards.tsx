import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTable, type ReportColumnDef, type ReportRow } from "./report-table";
import {
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

export async function ReportsStatsRow() {
  const policiesByStatusRows = await getPoliciesByStatus();
  const activePremium = policiesByStatusRows.find((r) => r.status === "active")?.premium_sum ?? 0;

  return (
    <div className="grid grid-cols-1">
      <StatCard label="Ενεργό ασφάλιστρο" value={`${activePremium.toFixed(2)} €`} />
    </div>
  );
}

export async function PoliciesByStatusTable() {
  const rows = await getPoliciesByStatus();
  const columns: ReportColumnDef[] = [
    { key: "status", label: "Κατάσταση" },
    { key: "policy_count", label: "Πλήθος" },
  ];
  const tableRows: ReportRow[] = rows.map((r) => ({
    id: r.status,
    cells: {
      status: { display: POLICY_STATUS_LABELS[r.status] ?? r.status, sortKey: POLICY_STATUS_LABELS[r.status] ?? r.status },
      policy_count: { display: String(r.policy_count), sortKey: r.policy_count },
    },
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Συμβόλαια ανά κατάσταση</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={tableRows} emptyMessage="Δεν υπάρχουν συμβόλαια." />
      </CardContent>
    </Card>
  );
}

export async function PoliciesByLineTable() {
  const rows = await getPoliciesByLine();
  const columns: ReportColumnDef[] = [
    { key: "line_name", label: "Κλάδος" },
    { key: "policy_count", label: "Πλήθος" },
    { key: "premium_sum", label: "Σύνολο ασφαλίστρου" },
  ];
  const tableRows: ReportRow[] = rows.map((r) => ({
    id: r.line_name,
    cells: {
      line_name: { display: r.line_name, sortKey: r.line_name },
      policy_count: { display: String(r.policy_count), sortKey: r.policy_count },
      premium_sum: { display: `${r.premium_sum.toFixed(2)} €`, sortKey: r.premium_sum },
    },
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ασφάλιστρο ανά κλάδο</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={tableRows} emptyMessage="Δεν υπάρχουν συμβόλαια." />
      </CardContent>
    </Card>
  );
}

export async function ClaimsByStatusTable() {
  const rows = await getClaimsByStatus();
  const columns: ReportColumnDef[] = [
    { key: "status", label: "Κατάσταση" },
    { key: "claim_count", label: "Πλήθος" },
    { key: "amount_sum", label: "Ποσό" },
  ];
  const tableRows: ReportRow[] = rows.map((r) => ({
    id: r.status,
    cells: {
      status: { display: CLAIM_STATUS_LABELS[r.status] ?? r.status, sortKey: CLAIM_STATUS_LABELS[r.status] ?? r.status },
      claim_count: { display: String(r.claim_count), sortKey: r.claim_count },
      amount_sum: { display: `${r.amount_sum.toFixed(2)} €`, sortKey: r.amount_sum },
    },
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ζημιές ανά κατάσταση</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={tableRows} emptyMessage="Δεν υπάρχουν ζημιές." />
      </CardContent>
    </Card>
  );
}

export async function ReferralBreakdownTable() {
  const rows = [...(await getReferralBreakdown())].sort((a, b) => b.client_count - a.client_count);
  const columns: ReportColumnDef[] = [
    { key: "source", label: "Πηγή" },
    { key: "client_count", label: "Πλήθος" },
  ];
  const tableRows: ReportRow[] = rows.map((r) => ({
    id: r.source,
    cells: {
      source: { display: r.source, sortKey: r.source },
      client_count: { display: String(r.client_count), sortKey: r.client_count },
    },
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Πελάτες ανά πηγή σύστασης</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={tableRows} emptyMessage="Δεν υπάρχουν πελάτες ακόμα." />
      </CardContent>
    </Card>
  );
}
