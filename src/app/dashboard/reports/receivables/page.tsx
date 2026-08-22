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
import { getActiveAgentsCached } from "@/lib/cached-queries/lookups";

const FORM_ID = "receivables-filters";

// Ό,τι επιστρέφει η receivables_aging (migration 0113). Τα numeric της
// Postgres φτάνουν ως string μέσω PostgREST, γι' αυτό περνούν από Number().
type AgingRow = {
  client_id: string | null;
  client_name: string | null;
  phone_mobile: string | null;
  bucket_current: string;
  bucket_30: string;
  bucket_60: string;
  bucket_90: string;
  bucket_90_plus: string;
  total: string;
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

  // Η ενηλικίωση γίνεται ΣΤΗ ΒΑΣΗ (migration 0113). Πριν, η σελίδα κατέβαζε
  // έως 20.000 ανοιχτές δόσεις σε σειριακό βρόχο — μία διαδρομή ανά 1.000
  // γραμμές — και τις μοίραζε σε κάδους με JavaScript, δηλαδή ο χρόνος
  // μεγάλωνε γραμμικά με τα δεδομένα.
  const [agents, { data: agingData, error: agingError }] = await Promise.all([
    getActiveAgentsCached(),
    admin.rpc("receivables_aging", { p_agent_id: agentId || null }),
  ]);
  const loadError = Boolean(agingError);

  // Η συνάρτηση επιστρέφει και τη γραμμή συνόλων μαζί με τις γραμμές πελατών
  // (client_id null), ώστε να μη χρειάζεται δεύτερο ερώτημα ούτε νέο άθροισμα.
  const aging = (agingData ?? []) as unknown as AgingRow[];
  const totalsRow = aging.find((r) => r.client_id === null) ?? null;
  const rows: ClientBucketRow[] = aging
    .filter((r) => r.client_id !== null)
    .map((r) => ({
      clientId: r.client_id as string,
      name: r.client_name ?? "—",
      phone: r.phone_mobile,
      current: Number(r.bucket_current),
      b30: Number(r.bucket_30),
      b60: Number(r.bucket_60),
      b90: Number(r.bucket_90),
      b90plus: Number(r.bucket_90_plus),
      total: Number(r.total),
    }));
  const totals = {
    current: Number(totalsRow?.bucket_current ?? 0),
    b30: Number(totalsRow?.bucket_30 ?? 0),
    b60: Number(totalsRow?.bucket_60 ?? 0),
    b90: Number(totalsRow?.bucket_90 ?? 0),
    b90plus: Number(totalsRow?.bucket_90_plus ?? 0),
    total: Number(totalsRow?.total ?? 0),
  };

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
                  options={agents}
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
