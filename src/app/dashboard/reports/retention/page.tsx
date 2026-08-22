import { redirect } from "next/navigation";
import { athensToday } from "@/lib/date";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
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

const FORM_ID = "retention-filters";

const GROUP_BY_OPTIONS = [
  { id: "carrier", label: "Ανά εταιρεία" },
  { id: "line", label: "Ανά κλάδο" },
  { id: "agent", label: "Ανά συνεργάτη" },
];

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type RawPolicyRow = {
  id: string;
  status: string;
  renewal_number: number;
  end_date: string;
  premium_gross: number;
  carriers: SingleOrMany<{ name: string }>;
  insurance_lines: SingleOrMany<{ name_el: string }>;
  agency_users: SingleOrMany<{ full_name: string }>;
};

type ExpiringRow = {
  id: string;
  status: string;
  renewal_number: number;
  end_date: string;
  premium_gross: number;
  carrier_name: string | null;
  line_name: string | null;
  agent_name: string | null;
};

type GroupStats = {
  key: string;
  label: string;
  expiring: number;
  renewed: number;
  cancelled: number;
  lapsed: number;
  premiumRenewed: number;
  premiumLost: number;
};

// Ανανεωσιμότητα / Ακυρωσιμότητα — of the terms that ENDED inside the
// chosen window, how many carried on (the policy row lives on with a
// bumped renewal_number, or is still active past that end date) versus how
// many were cancelled or lapsed. The permanent-policy model makes this
// readable straight off `policies`: a renewed policy keeps ONE row whose
// renewal_number grew, so "ended in the window and still active/renewed"
// is the retention signal, while cancelled/lapsed is the loss signal.
export default async function RetentionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group_by?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const today = athensToday();
  const defaultFrom = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const from = sp.from || defaultFrom;
  const to = sp.to || today;
  const groupBy = ["carrier", "line", "agent"].includes(sp.group_by ?? "") ? sp.group_by! : "carrier";
  const admin = createAdminClient();

  // Chunked past PostgREST's 1000-row cap — a year's expirations across
  // 20k policies runs into the thousands.
  const CHUNK = 1000;
  const MAX_ROWS = 30000;
  const rows: ExpiringRow[] = [];
  let loadError = false;
  for (let start = 0; start < MAX_ROWS; start += CHUNK) {
    const { data, error } = await admin
      .from("policies")
      .select(
        "id, status, renewal_number, end_date, premium_gross, " +
          "carriers(name), insurance_lines(name_el), agency_users!policies_assigned_agent_id_fkey(full_name)",
      )
      .gte("end_date", from)
      .lte("end_date", to)
      .neq("status", "draft")
      .order("end_date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + CHUNK - 1);
    if (error) {
      loadError = true;
      break;
    }
    const batch = ((data ?? []) as unknown as RawPolicyRow[]).map((p) => ({
      id: p.id,
      status: p.status,
      renewal_number: p.renewal_number,
      end_date: p.end_date,
      premium_gross: p.premium_gross,
      carrier_name: one(p.carriers)?.name ?? null,
      line_name: one(p.insurance_lines)?.name_el ?? null,
      agent_name: one(p.agency_users)?.full_name ?? null,
    }));
    rows.push(...batch);
    if (batch.length < CHUNK) break;
  }

  const groups = new Map<string, GroupStats>();
  for (const r of rows) {
    const label =
      (groupBy === "carrier" ? r.carrier_name : groupBy === "line" ? r.line_name : r.agent_name) ?? "—";
    const g = groups.get(label) ?? {
      key: label,
      label,
      expiring: 0,
      renewed: 0,
      cancelled: 0,
      lapsed: 0,
      premiumRenewed: 0,
      premiumLost: 0,
    };
    g.expiring += 1;
    // A term whose end_date is in the window but whose policy is still
    // active/pending today means the row moved on to a new term (or hasn't
    // been touched yet but is still alive) — retained. cancelled/lapsed
    // are the two explicit loss states.
    if (r.status === "cancelled") {
      g.cancelled += 1;
      g.premiumLost += r.premium_gross;
    } else if (r.status === "lapsed") {
      g.lapsed += 1;
      g.premiumLost += r.premium_gross;
    } else if (r.status === "active" || r.status === "pending_renewal") {
      g.renewed += 1;
      g.premiumRenewed += r.premium_gross;
    }
    groups.set(label, g);
  }

  const list = [...groups.values()].sort((a, b) => b.expiring - a.expiring);
  const totals = list.reduce(
    (acc, g) => ({
      expiring: acc.expiring + g.expiring,
      renewed: acc.renewed + g.renewed,
      cancelled: acc.cancelled + g.cancelled,
      lapsed: acc.lapsed + g.lapsed,
      premiumRenewed: acc.premiumRenewed + g.premiumRenewed,
      premiumLost: acc.premiumLost + g.premiumLost,
    }),
    { expiring: 0, renewed: 0, cancelled: 0, lapsed: 0, premiumRenewed: 0, premiumLost: 0 },
  );

  function rate(renewed: number, expiring: number) {
    return expiring > 0 ? `${((renewed / expiring) * 100).toFixed(1)}%` : "—";
  }

  const groupLabel =
    groupBy === "carrier" ? "Εταιρεία" : groupBy === "line" ? "Κλάδος" : "Συνεργάτης";

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader title="Ανανεωσιμότητα & Ακυρωσιμότητα" />
      <div className="no-print">
        <ListPageHeader title="Ανανεωσιμότητα" actions={<PrintButton />} />
      </div>

      <div className="print-grid grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="no-print">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Κριτήρια</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Προβολή</Label>
                <FilterSelect
                  form={FORM_ID}
                  name="group_by"
                  defaultValue={groupBy}
                  options={GROUP_BY_OPTIONS}
                  hideAll
                  className="h-9 w-full text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Λήξεις από/έως</Label>
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
          {loadError ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Σφάλμα κατά τη φόρτωση. Στένεψε το διάστημα και δοκίμασε ξανά.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                <div className="rounded-md border bg-muted px-4 py-2">
                  <p className="text-xs text-muted-foreground">Ποσοστό ανανέωσης</p>
                  <p className="text-lg font-semibold">{rate(totals.renewed, totals.expiring)}</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Λήξεις περιόδου</p>
                  <p className="text-lg font-semibold">{totals.expiring}</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Ασφάλιστρα που κρατήθηκαν</p>
                  <p className="text-lg font-semibold">{totals.premiumRenewed.toFixed(2)} €</p>
                </div>
                <div className="rounded-md border px-4 py-2">
                  <p className="text-xs text-muted-foreground">Ασφάλιστρα που χάθηκαν</p>
                  <p className="text-lg font-semibold">{totals.premiumLost.toFixed(2)} €</p>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupLabel}</TableHead>
                      <TableHead className="text-right">Λήξεις</TableHead>
                      <TableHead className="text-right">Ανανεώθηκαν</TableHead>
                      <TableHead className="text-right">Ακυρώθηκαν</TableHead>
                      <TableHead className="text-right">Διακοπές</TableHead>
                      <TableHead className="text-right">Ποσοστό</TableHead>
                      <TableHead className="text-right">Ασφάλιστρα που κρατήθηκαν</TableHead>
                      <TableHead className="text-right">Ασφάλιστρα που χάθηκαν</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.length ? (
                      <>
                        {list.map((g) => (
                          <TableRow key={g.key}>
                            <TableCell>{g.label}</TableCell>
                            <TableCell className="text-right">{g.expiring}</TableCell>
                            <TableCell className="text-right">{g.renewed}</TableCell>
                            <TableCell className="text-right">{g.cancelled}</TableCell>
                            <TableCell className="text-right">{g.lapsed}</TableCell>
                            <TableCell className="text-right font-medium">{rate(g.renewed, g.expiring)}</TableCell>
                            <TableCell className="text-right">{g.premiumRenewed.toFixed(2)} €</TableCell>
                            <TableCell className="text-right">{g.premiumLost.toFixed(2)} €</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell>Σύνολα</TableCell>
                          <TableCell className="text-right">{totals.expiring}</TableCell>
                          <TableCell className="text-right">{totals.renewed}</TableCell>
                          <TableCell className="text-right">{totals.cancelled}</TableCell>
                          <TableCell className="text-right">{totals.lapsed}</TableCell>
                          <TableCell className="text-right">{rate(totals.renewed, totals.expiring)}</TableCell>
                          <TableCell className="text-right">{totals.premiumRenewed.toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{totals.premiumLost.toFixed(2)} €</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Καμία λήξη στο επιλεγμένο διάστημα.
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
