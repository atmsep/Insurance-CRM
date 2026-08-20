import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../../policies/movement-labels";
import { parseProductionFilters, applyProductionFilters } from "../filters";
import { fetchAllProductionEntries } from "../data";
import { getOutgoingCommissionsByMovement } from "../commissions";
import { ReportPrintHeader } from "../../_components/report-print-header";

// A print job is a person waiting on a browser tab, not a background
// download like the CSV export (30,000-row cap) — an unfiltered click
// here would otherwise try to fetch this table's full 20k+ rows through
// dozens of sequential chunked round-trips (see ../data.ts) and hang the
// tab for minutes. Confirmed live: an unfiltered request tied up the dev
// server long enough that even unrelated requests stopped responding.
const MAX_PRINT_ROWS = 5000;

// Full-dataset print view (see ../data.ts) — the on-screen report at
// ../page.tsx paginates, so window.print() from there would only ever
// capture whatever page happened to be open. This route re-fetches the
// same filtered set in full instead, exactly like the CSV export does.
export default async function ProductionPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";

  const sp = await searchParams;
  const filters = parseProductionFilters(sp);
  // Same self-scope forcing as the report page and the CSV export.
  if (!isAdmin) filters.agentIds = [agencyUser.id];
  const admin = createAdminClient();

  let countQuery = admin.from("production_entries").select("id", { count: "exact", head: true });
  countQuery = applyProductionFilters(countQuery, filters);
  const { count } = await countQuery;

  if ((count ?? 0) > MAX_PRINT_ROWS) {
    return (
      <div className="flex flex-col gap-4">
        <ReportPrintHeader title="Παραγωγή (Αναλυτικά)" />
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
          Το φιλτραρισμένο αποτέλεσμα έχει {count?.toLocaleString("el-GR")} γραμμές — πολλές για εκτύπωση.
          Στένεψε τα φίλτρα (π.χ. συνεργάτης ή διάστημα ημερομηνιών) σε λιγότερες από{" "}
          {MAX_PRINT_ROWS.toLocaleString("el-GR")} και δοκίμασε ξανά, ή χρησιμοποίησε την Εξαγωγή για ολόκληρη
          τη λίστα.
        </div>
      </div>
    );
  }

  const [{ data: totalsData }, rows] = await Promise.all([
    admin
      .rpc("production_entries_totals", {
        p_document: filters.document ?? null,
        p_policy_number: filters.policyNumber ?? null,
        p_risk: filters.risk ?? null,
        p_client_name: filters.clientName ?? null,
        p_agent_ids: filters.agentIds ?? null,
        p_carrier_id: filters.carrierId ?? null,
        p_line_id: filters.lineId ?? null,
        p_kinds: filters.kinds ?? null,
        p_issue_from: filters.issueFrom ?? null,
        p_issue_to: filters.issueTo ?? null,
        p_start_from: filters.startFrom ?? null,
        p_start_to: filters.startTo ?? null,
        p_status: filters.status ?? null,
      })
      .single(),
    fetchAllProductionEntries(admin, filters),
  ]);
  const totals = totalsData as unknown as {
    premium_gross_sum: number;
    premium_net_sum: number;
    commission_sum: number;
  } | null;

  const commissionByMovement = await getOutgoingCommissionsByMovement(
    admin,
    rows.map((r) => ({ id: r.id, isReal: r.is_real })),
  );

  return (
    <div className="flex flex-col gap-4">
      <AutoPrint />
      <div className="no-print">
        <PrintButton />
      </div>
      <ReportPrintHeader title="Παραγωγή (Αναλυτικά)" />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Συνεργάτης</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Απόδειξη</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Είδος</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Χαρακτ.</TableHead>
              <TableHead>Έκδοση</TableHead>
              <TableHead>Έναρξη</TableHead>
              <TableHead>Λήξη</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Σταθερό/Κινητό</TableHead>
              <TableHead className="text-right">Μικτά</TableHead>
              <TableHead className="text-right">Καθαρά</TableHead>
              <TableHead className="text-right">Προμήθεια</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => {
                const phone = [row.phone_mobile, row.phone_landline].filter(Boolean).join(" / ");
                const commission = commissionByMovement.get(row.id);
                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.agent_name ?? "—"}</TableCell>
                    <TableCell>{row.policy_number}</TableCell>
                    <TableCell>{row.document_number ?? "—"}</TableCell>
                    <TableCell>{row.carrier_name ?? "—"}</TableCell>
                    <TableCell>{POLICY_MOVEMENT_KIND_LABELS[row.kind] ?? row.kind}</TableCell>
                    <TableCell>{row.line_name ?? "—"}</TableCell>
                    <TableCell>{row.risk_label ?? "—"}</TableCell>
                    <TableCell>{formatDate(row.issue_date)}</TableCell>
                    <TableCell>{formatDate(row.start_date)}</TableCell>
                    <TableCell>{formatDate(row.end_date)}</TableCell>
                    <TableCell>{row.client_name ?? "—"}</TableCell>
                    <TableCell>{phone || "—"}</TableCell>
                    <TableCell className="text-right">{row.premium_gross.toFixed(2)} €</TableCell>
                    <TableCell className="text-right">
                      {row.premium_net != null ? `${row.premium_net.toFixed(2)} €` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {commission != null ? `${commission.toFixed(2)} €` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν κινήσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-8 border-t pt-2 text-sm font-semibold">
        <span>Σύνολα ({rows.length}):</span>
        <span>Μικτά: {(totals?.premium_gross_sum ?? 0).toFixed(2)} €</span>
        <span>Καθαρά: {(totals?.premium_net_sum ?? 0).toFixed(2)} €</span>
        <span>Προμήθεια: {(totals?.commission_sum ?? 0).toFixed(2)} €</span>
      </div>
    </div>
  );
}
