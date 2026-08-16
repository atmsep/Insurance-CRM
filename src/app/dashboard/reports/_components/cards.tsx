import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTable, type ReportColumn } from "./report-table";
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
  const columns: ReportColumn<(typeof rows)[number]>[] = [
    { key: "status", label: "Κατάσταση", getValue: (r) => POLICY_STATUS_LABELS[r.status] ?? r.status, getSortKey: (r) => POLICY_STATUS_LABELS[r.status] ?? r.status },
    { key: "policy_count", label: "Πλήθος", getValue: (r) => String(r.policy_count), getSortKey: (r) => r.policy_count },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Συμβόλαια ανά κατάσταση</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.status} emptyMessage="Δεν υπάρχουν συμβόλαια." />
      </CardContent>
    </Card>
  );
}

export async function PoliciesByLineTable() {
  const rows = await getPoliciesByLine();
  const columns: ReportColumn<(typeof rows)[number]>[] = [
    { key: "line_name", label: "Κλάδος", getValue: (r) => r.line_name, getSortKey: (r) => r.line_name },
    { key: "policy_count", label: "Πλήθος", getValue: (r) => String(r.policy_count), getSortKey: (r) => r.policy_count },
    {
      key: "premium_sum",
      label: "Σύνολο ασφαλίστρου",
      getValue: (r) => `${r.premium_sum.toFixed(2)} €`,
      getSortKey: (r) => r.premium_sum,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ασφάλιστρο ανά κλάδο</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.line_name} emptyMessage="Δεν υπάρχουν συμβόλαια." />
      </CardContent>
    </Card>
  );
}

export async function ClaimsByStatusTable() {
  const rows = await getClaimsByStatus();
  const columns: ReportColumn<(typeof rows)[number]>[] = [
    { key: "status", label: "Κατάσταση", getValue: (r) => CLAIM_STATUS_LABELS[r.status] ?? r.status, getSortKey: (r) => CLAIM_STATUS_LABELS[r.status] ?? r.status },
    { key: "claim_count", label: "Πλήθος", getValue: (r) => String(r.claim_count), getSortKey: (r) => r.claim_count },
    { key: "amount_sum", label: "Ποσό", getValue: (r) => `${r.amount_sum.toFixed(2)} €`, getSortKey: (r) => r.amount_sum },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ζημιές ανά κατάσταση</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.status} emptyMessage="Δεν υπάρχουν ζημιές." />
      </CardContent>
    </Card>
  );
}

export async function ReferralBreakdownTable() {
  const rows = [...(await getReferralBreakdown())].sort((a, b) => b.client_count - a.client_count);
  const columns: ReportColumn<(typeof rows)[number]>[] = [
    { key: "source", label: "Πηγή", getValue: (r) => r.source, getSortKey: (r) => r.source },
    { key: "client_count", label: "Πλήθος", getValue: (r) => String(r.client_count), getSortKey: (r) => r.client_count },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Πελάτες ανά πηγή σύστασης</CardTitle>
      </CardHeader>
      <CardContent>
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.source} emptyMessage="Δεν υπάρχουν πελάτες ακόμα." />
      </CardContent>
    </Card>
  );
}

