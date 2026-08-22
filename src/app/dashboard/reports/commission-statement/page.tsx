import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";
import { ListPageHeader } from "@/components/list-page-header";
import { ReportPrintHeader } from "../_components/report-print-header";
import { formatDate, athensToday } from "@/lib/date";

const FORM_ID = "commission-statement-filters";

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  new_business: "Νέα εργασία",
  renewal: "Ανανέωση",
  override: "Override",
  cancellation: "Ακύρωση",
  endorsement: "Πρόσθετη πράξη",
};

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type MovementEmbed = SingleOrMany<{
  document_number: string | null;
  issue_date: string;
  outgoing_commission_remitted_at: string | null;
}>;

type StatementRow = {
  id: string;
  period: string | null;
  commission_type: string;
  base_amount: number | null;
  commission_rate_percent: number | null;
  commission_amount: number;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
  }>;
  carriers: SingleOrMany<{ name: string }>;
  // Normal commissions hang off a δόση whose movement carries the remit
  // stamp; cancellation clawbacks hang off the movement directly (0087).
  policy_installments: SingleOrMany<{ policy_movements: MovementEmbed }>;
  policy_movements: MovementEmbed;
};

function movementOf(row: StatementRow) {
  const viaInstallment = one(one(row.policy_installments)?.policy_movements ?? null);
  return viaInstallment ?? one(row.policy_movements);
}

// Athens calendar date, for the default period bounds.
// Εκκαθάριση προμηθειών συνεργάτη — the printable per-agent statement of
// every outgoing commission earned in a period, with its remit status and
// totals. Admin client for the same statement-timeout reason as every
// report page; admin-only like the rest of Αναφορές.
export default async function CommissionStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; from?: string; to?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const today = athensToday();
  const monthStart = today.slice(0, 8) + "01";
  const agentId = sp.agent || "";
  const from = sp.from || monthStart;
  const to = sp.to || today;
  const admin = createAdminClient();

  const { data: agents } = await admin
    .from("agency_users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");
  const selectedAgent = (agents ?? []).find((a) => a.id === agentId) ?? null;

  const rows: StatementRow[] = [];
  let loadError = false;
  if (selectedAgent) {
    // Chunked past PostgREST's silent 1000-row cap — a whole year's
    // statement for a productive agent can exceed it.
    const CHUNK = 1000;
    const MAX_ROWS = 10000;
    for (let start = 0; start < MAX_ROWS; start += CHUNK) {
      const { data, error } = await admin
        .from("commissions")
        .select(
          "id, period, commission_type, base_amount, commission_rate_percent, commission_amount, " +
            "policies!inner(policy_number, risk_label, clients!inner(display_name)), carriers(name), " +
            "policy_installments(policy_movements(document_number, issue_date, outgoing_commission_remitted_at)), " +
            "policy_movements(document_number, issue_date, outgoing_commission_remitted_at)",
        )
        .eq("direction", "outgoing")
        .eq("agent_id", selectedAgent.id)
        .gte("period", from)
        .lte("period", to)
        .order("period", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + CHUNK - 1);
      if (error) {
        loadError = true;
        break;
      }
      const batch = (data ?? []) as unknown as StatementRow[];
      rows.push(...batch);
      if (batch.length < CHUNK) break;
    }
  }

  const totalCommission = rows.reduce((sum, r) => sum + r.commission_amount, 0);
  const totalBase = rows.reduce((sum, r) => sum + (r.base_amount ?? 0), 0);
  const remitted = rows.filter((r) => movementOf(r)?.outgoing_commission_remitted_at);
  const remittedTotal = remitted.reduce((sum, r) => sum + r.commission_amount, 0);
  const pendingTotal = totalCommission - remittedTotal;

  const title = selectedAgent
    ? `Εκκαθάριση Προμηθειών — ${selectedAgent.full_name} (${formatDate(from)} έως ${formatDate(to)})`
    : "Εκκαθάριση Προμηθειών";

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader title={title} />
      <div className="no-print">
        <ListPageHeader title="Εκκαθάριση Προμηθειών" actions={selectedAgent ? <PrintButton /> : undefined} />
      </div>

      <div className="print-grid grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="no-print">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Κριτήρια εκκαθάρισης</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Συνεργάτης</Label>
                <FilterSelect
                  form={FORM_ID}
                  name="agent"
                  defaultValue={agentId}
                  allLabel="— Επίλεξε συνεργάτη —"
                  options={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
                  className="h-9 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Περίοδος</Label>
                <div className="flex items-center gap-2">
                  <Input aria-label="Από" form={FORM_ID} name="from" type="date" defaultValue={from} />
                  <span className="text-sm text-muted-foreground">έως</span>
                  <Input aria-label="Έως" form={FORM_ID} name="to" type="date" defaultValue={to} />
                </div>
              </div>
              <Button type="submit" form={FORM_ID} variant="secondary" size="sm">
                Εφαρμογή
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {!selectedAgent ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Επίλεξε συνεργάτη και περίοδο για να εμφανιστεί η εκκαθάριση.
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Σφάλμα κατά τη φόρτωση της εκκαθάρισης. Δοκίμασε ξανά.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-md border bg-muted px-4 py-2">
                  <p className="text-xs text-muted-foreground">Σύνολο προμηθειών</p>
                  <p className="text-lg font-semibold">{totalCommission.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Αποδοθείσες</p>
                  <p className="text-lg font-semibold">{remittedTotal.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Εκκρεμείς</p>
                  <p className="text-lg font-semibold">{pendingTotal.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Εγγραφές</p>
                  <p className="text-lg font-semibold">{rows.length}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ημ/νία</TableHead>
                      <TableHead>Παραστατικό</TableHead>
                      <TableHead>Πελάτης</TableHead>
                      <TableHead>Εταιρεία</TableHead>
                      <TableHead>Είδος</TableHead>
                      <TableHead className="text-right">Καθαρά</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Προμήθεια</TableHead>
                      <TableHead>Απόδοση</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length ? (
                      rows.map((r) => {
                        const policy = one(r.policies);
                        const client = one(policy?.clients ?? null);
                        const carrier = one(r.carriers);
                        const movement = movementOf(r);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{formatDate(movement?.issue_date ?? r.period ?? "")}</TableCell>
                            <TableCell>{movement?.document_number ?? policy?.policy_number ?? "—"}</TableCell>
                            <TableCell>{client?.display_name ?? "—"}</TableCell>
                            <TableCell>{carrier?.name ?? "—"}</TableCell>
                            <TableCell>{COMMISSION_TYPE_LABELS[r.commission_type] ?? r.commission_type}</TableCell>
                            <TableCell className="text-right">{(r.base_amount ?? 0).toFixed(2)} €</TableCell>
                            <TableCell className="text-right">
                              {r.commission_rate_percent != null ? `${r.commission_rate_percent}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {r.commission_amount.toFixed(2)} €
                            </TableCell>
                            <TableCell>
                              {movement?.outgoing_commission_remitted_at ? (
                                <Badge variant="success">{formatDate(movement.outgoing_commission_remitted_at)}</Badge>
                              ) : (
                                <Badge variant="warning">Εκκρεμεί</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Καμία προμήθεια στη συγκεκριμένη περίοδο.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.length > 0 && (
                      <TableRow className="font-semibold">
                        <TableCell colSpan={5}>Σύνολα</TableCell>
                        <TableCell className="text-right">{totalBase.toFixed(2)} €</TableCell>
                        <TableCell />
                        <TableCell className="text-right">{totalCommission.toFixed(2)} €</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="print-only mt-10 text-sm">
                <div className="flex items-end justify-between">
                  <div className="w-56 border-t pt-2 text-center text-muted-foreground">Ο συνεργάτης</div>
                  <div className="w-56 border-t pt-2 text-center text-muted-foreground">Για το γραφείο</div>
                </div>
              </div>
            </>
          )}

          <form id={FORM_ID} />
        </div>
      </div>
    </div>
  );
}
