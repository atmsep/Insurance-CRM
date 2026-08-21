import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { isBillablePolicyStatus, installmentRemaining } from "../../policies/balance";

const FORM_ID = "receivables-filters";

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type OpenInstallmentRow = {
  id: string;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  policies: SingleOrMany<{
    id: string;
    status: string;
    assigned_agent_id: string | null;
    clients: SingleOrMany<{ id: string; display_name: string | null; phone_mobile: string | null }>;
  }>;
};

type ClientBucketRow = {
  clientId: string;
  name: string;
  phone: string | null;
  current: number; // not yet due
  b30: number;
  b60: number;
  b90: number;
  b90plus: number;
  total: number;
};

// Ενηπερημερίες πελατών — every open δόση bucketed by how long it's been
// overdue, grouped per client, ordered by total owed. The daily worklist
// for "ποιον παίρνουμε τηλέφωνο για οφειλές". Admin client + admin-only,
// same as the other report pages.
export default async function ReceivablesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const agentId = sp.agent || "";
  const admin = createAdminClient();

  const { data: agents } = await admin
    .from("agency_users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  // Chunked past PostgREST's silent 1000-row cap (666 open δόσεις today,
  // and the reimport will multiply that).
  const CHUNK = 1000;
  const MAX_ROWS = 20000;
  const open: OpenInstallmentRow[] = [];
  let loadError = false;
  for (let start = 0; start < MAX_ROWS; start += CHUNK) {
    let q = admin
      .from("policy_installments")
      .select(
        "id, due_date, amount, paid_amount, " +
          "policies!inner(id, status, assigned_agent_id, clients!inner(id, display_name, phone_mobile))",
      )
      .in("status", ["pending", "overdue", "partially_paid"])
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + CHUNK - 1);
    if (agentId) q = q.eq("policies.assigned_agent_id", agentId);
    const { data, error } = await q;
    if (error) {
      loadError = true;
      break;
    }
    const batch = (data ?? []) as unknown as OpenInstallmentRow[];
    open.push(...batch);
    if (batch.length < CHUNK) break;
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  const msPerDay = 24 * 60 * 60 * 1000;
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();

  const byClient = new Map<string, ClientBucketRow>();
  for (const inst of open) {
    const policy = one(inst.policies);
    if (!policy || !isBillablePolicyStatus(policy.status)) continue;
    const remaining = installmentRemaining(inst);
    if (remaining <= 0) continue;
    const client = one(policy.clients);
    if (!client) continue;

    const row = byClient.get(client.id) ?? {
      clientId: client.id,
      name: client.display_name ?? "—",
      phone: client.phone_mobile,
      current: 0,
      b30: 0,
      b60: 0,
      b90: 0,
      b90plus: 0,
      total: 0,
    };
    const overdueDays = Math.floor((todayMs - new Date(`${inst.due_date}T00:00:00Z`).getTime()) / msPerDay);
    if (overdueDays <= 0) row.current += remaining;
    else if (overdueDays <= 30) row.b30 += remaining;
    else if (overdueDays <= 60) row.b60 += remaining;
    else if (overdueDays <= 90) row.b90 += remaining;
    else row.b90plus += remaining;
    row.total += remaining;
    byClient.set(client.id, row);
  }

  const rows = [...byClient.values()].sort((a, b) => b.total - a.total);
  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      b30: acc.b30 + r.b30,
      b60: acc.b60 + r.b60,
      b90: acc.b90 + r.b90,
      b90plus: acc.b90plus + r.b90plus,
      total: acc.total + r.total,
    }),
    { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader title="Καθυστερούμενες Οφειλές Πελατών" />
      <div className="no-print">
        <ListPageHeader title="Καθυστερούμενες Οφειλές" actions={<PrintButton />} />
      </div>

      <div className="print-grid grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="no-print">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Κριτήρια</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Συνεργάτης</Label>
                <FilterSelect
                  form={FORM_ID}
                  name="agent"
                  defaultValue={agentId}
                  allLabel="Όλοι οι συνεργάτες"
                  options={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
                  className="h-9 w-full text-sm"
                />
              </div>
              <Button type="submit" form={FORM_ID} variant="secondary" size="sm">
                Εφαρμογή
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {loadError ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Σφάλμα κατά τη φόρτωση των οφειλών. Δοκίμασε ξανά.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-md border bg-muted px-4 py-2">
                  <p className="text-xs text-muted-foreground">Σύνολο οφειλών</p>
                  <p className="text-lg font-semibold">{totals.total.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Σε καθυστέρηση 90+ ημερών</p>
                  <p className="text-lg font-semibold">{totals.b90plus.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Πελάτες με οφειλή</p>
                  <p className="text-lg font-semibold">{rows.length}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Πελάτης</TableHead>
                      <TableHead>Τηλέφωνο</TableHead>
                      <TableHead className="text-right">Τρέχουσες</TableHead>
                      <TableHead className="text-right">1–30 ημ.</TableHead>
                      <TableHead className="text-right">31–60 ημ.</TableHead>
                      <TableHead className="text-right">61–90 ημ.</TableHead>
                      <TableHead className="text-right">90+ ημ.</TableHead>
                      <TableHead className="text-right">Σύνολο</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length ? (
                      <>
                        {rows.map((r) => (
                          <TableRow key={r.clientId}>
                            <TableCell>
                              <Link href={`/dashboard/clients/${r.clientId}`} className="hover:underline">
                                {r.name}
                              </Link>
                            </TableCell>
                            <TableCell>{r.phone ?? "—"}</TableCell>
                            <TableCell className="text-right">{r.current ? `${r.current.toFixed(2)} €` : "—"}</TableCell>
                            <TableCell className="text-right">{r.b30 ? `${r.b30.toFixed(2)} €` : "—"}</TableCell>
                            <TableCell className="text-right">{r.b60 ? `${r.b60.toFixed(2)} €` : "—"}</TableCell>
                            <TableCell className="text-right">{r.b90 ? `${r.b90.toFixed(2)} €` : "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {r.b90plus ? `${r.b90plus.toFixed(2)} €` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{r.total.toFixed(2)} €</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell colSpan={2}>Σύνολα</TableCell>
                          <TableCell className="text-right">{totals.current.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.b30.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.b60.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.b90.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.b90plus.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.total.toFixed(2)} €</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Δεν υπάρχουν ανοιχτές οφειλές.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

            </>
          )}

          <form id={FORM_ID} />
        </div>
      </div>
    </div>
  );
}
