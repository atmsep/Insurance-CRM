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

// Ό,τι επιστρέφει η retention_summary (migration 0115). Τα count/numeric της
// Postgres φτάνουν ως string μέσω PostgREST.
type RetentionRow = {
  group_key: string;
  expiring: string;
  renewed: string;
  cancelled: string;
  lapsed: string;
  premium_renewed: string;
  premium_lost: string;
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

  // Η ομαδοποίηση γίνεται ΣΤΗ ΒΑΣΗ (migration 0115). Πριν, η σελίδα
  // κατέβαζε έως 30.000 συμβόλαια σε σειριακό βρόχο και τα μετρούσε σε
  // JavaScript· ένα έτος λήξεων είναι ήδη 2.397 συμβόλαια.
  const { data: rpcData, error: rpcError } = await admin.rpc("retention_summary", {
    p_from: from,
    p_to: to,
    p_group_by: groupBy,
  });
  const loadError = Boolean(rpcError);

  // Η συνάρτηση επιστρέφει ήδη ταξινομημένα κατά φθίνοντα λήγοντα, και το
  // σκεπτικό των κατηγοριών (τι μετράει ως διατήρηση, τι ως απώλεια) ζει
  // πλέον μέσα στο migration 0115 ώστε να μη διχάζεται σε δύο σημεία.
  const list: GroupStats[] = ((rpcData ?? []) as unknown as RetentionRow[]).map((r) => ({
    key: r.group_key,
    label: r.group_key,
    expiring: Number(r.expiring),
    renewed: Number(r.renewed),
    cancelled: Number(r.cancelled),
    lapsed: Number(r.lapsed),
    premiumRenewed: Number(r.premium_renewed),
    premiumLost: Number(r.premium_lost),
  }));
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
