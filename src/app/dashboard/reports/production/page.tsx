import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPageHeader } from "@/components/list-page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableHeader } from "@/components/sortable-header";
import { ClickableRow } from "@/components/clickable-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../policies/movement-labels";
import { parseProductionFilters, applyProductionFilters, parsePerPage } from "./filters";
import { getOutgoingCommissionsByMovement } from "./commissions";
import { ProductionFiltersPanel } from "./_components/production-filters-panel";
import { PageSizeSelect } from "../../policies/_components/page-size-select";

type ProductionRow = {
  id: string;
  policy_id: string;
  is_real: boolean;
  kind: string;
  document_number: string | null;
  issue_date: string;
  start_date: string;
  end_date: string;
  premium_net: number | null;
  premium_gross: number;
  outgoing_agent_id: string | null;
  agent_name: string | null;
  policy_number: string;
  risk_label: string | null;
  carrier_name: string | null;
  line_name: string | null;
  client_name: string | null;
  phone_mobile: string | null;
  phone_landline: string | null;
};

// production_entries (migration 0089) is a fully denormalized view — real
// policy_movements rows unioned with synthetic rows for legacy policies
// terms that predate the movements table — so every column here is a plain,
// 0-hop column. No embedding, so no PGRST201-ambiguity or embedded-order
// risk to design around.
const PRODUCTION_SELECT =
  "id, policy_id, is_real, kind, document_number, issue_date, start_date, end_date, " +
  "premium_net, premium_gross, outgoing_agent_id, agent_name, policy_number, risk_label, " +
  "carrier_name, line_name, client_name, phone_mobile, phone_landline";

const SORTABLE_COLUMNS: Record<string, { column: string }> = {
  agent: { column: "agent_name" },
  policy_number: { column: "policy_number" },
  document: { column: "document_number" },
  kind: { column: "kind" },
  risk: { column: "risk_label" },
  issue_date: { column: "issue_date" },
  start_date: { column: "start_date" },
  end_date: { column: "end_date" },
  premium_gross: { column: "premium_gross" },
  premium_net: { column: "premium_net" },
};

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    document?: string;
    policy_number?: string;
    risk?: string;
    client?: string;
    agent?: string;
    carrier?: string;
    line?: string;
    kind?: string;
    issue_from?: string;
    issue_to?: string;
    start_from?: string;
    start_to?: string;
    sort?: string;
    dir?: string;
    per_page?: string;
    page?: string;
  }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const filters = parseProductionFilters(sp);
  const admin = createAdminClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = parsePerPage(sp.per_page);

  const [{ data: agents }, { data: carriers }, { data: insuranceLines }] = await Promise.all([
    admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    admin.from("carriers").select("id, name").order("name"),
    admin.from("insurance_lines").select("id, name_el").order("sort_order"),
  ]);

  let query = admin.from("production_entries").select(PRODUCTION_SELECT, { count: "exact" });

  const sortable = filters.sort ? SORTABLE_COLUMNS[filters.sort] : undefined;
  query = sortable
    ? query.order(sortable.column, { ascending: filters.dir !== "desc" })
    : query.order("issue_date", { ascending: false });

  query = applyProductionFilters(query, filters);

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as ProductionRow[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const commissionByMovement = await getOutgoingCommissionsByMovement(
    admin,
    rows.map((r) => ({ id: r.id, isReal: r.is_real })),
  );

  const exportParams = new URLSearchParams();
  if (filters.document) exportParams.set("document", filters.document);
  if (filters.policyNumber) exportParams.set("policy_number", filters.policyNumber);
  if (filters.risk) exportParams.set("risk", filters.risk);
  if (filters.clientName) exportParams.set("client", filters.clientName);
  if (filters.agentIds?.length) exportParams.set("agent", filters.agentIds.join(","));
  if (filters.carrierId) exportParams.set("carrier", filters.carrierId);
  if (filters.lineId) exportParams.set("line", filters.lineId);
  if (filters.kinds?.length) exportParams.set("kind", filters.kinds.join(","));
  if (filters.issueFrom) exportParams.set("issue_from", filters.issueFrom);
  if (filters.issueTo) exportParams.set("issue_to", filters.issueTo);
  if (filters.startFrom) exportParams.set("start_from", filters.startFrom);
  if (filters.startTo) exportParams.set("start_to", filters.startTo);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Παραγωγή Αναλυτικά"
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/dashboard/reports/production/export?${exportParams.toString()}`}>Εξαγωγή</a>}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <ProductionFiltersPanel
          form="production-filters"
          agents={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
          carriers={(carriers ?? []).map((c) => ({ id: c.id, label: c.name }))}
          insuranceLines={(insuranceLines ?? []).map((l) => ({ id: l.id, label: l.name_el }))}
          agentIds={filters.agentIds}
          carrierId={filters.carrierId}
          lineId={filters.lineId}
          kinds={filters.kinds}
          issueFrom={filters.issueFrom}
          issueTo={filters.issueTo}
          startFrom={filters.startFrom}
          startTo={filters.startTo}
        />

        <div className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Σφάλμα κατά τη φόρτωση της παραγωγής. Δοκίμασε ξανά ή στένεψε τα φίλτρα.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader sortKey="agent" label="Συνεργάτης" />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="policy_number" label="Συμβόλαιο" />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="document" label="Απόδειξη" />
                    </TableHead>
                    <TableHead>Εταιρεία</TableHead>
                    <TableHead>
                      <SortableHeader sortKey="kind" label="Είδος" />
                    </TableHead>
                    <TableHead>Κλάδος</TableHead>
                    <TableHead>
                      <SortableHeader sortKey="risk" label="Χαρακτ." />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="issue_date" label="Έκδοση" />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="start_date" label="Έναρξη" />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="end_date" label="Λήξη" />
                    </TableHead>
                    <TableHead>Πελάτης</TableHead>
                    <TableHead>Σταθερό/Κινητό</TableHead>
                    <TableHead>
                      <SortableHeader sortKey="premium_gross" label="Μικτά" />
                    </TableHead>
                    <TableHead>
                      <SortableHeader sortKey="premium_net" label="Καθαρά" />
                    </TableHead>
                    <TableHead>Προμήθεια Συν.</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2">
                      <Input
                        form="production-filters"
                        name="policy_number"
                        placeholder="Συμβόλαιο..."
                        defaultValue={filters.policyNumber ?? ""}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="pb-2">
                      <Input
                        form="production-filters"
                        name="document"
                        placeholder="Απόδειξη..."
                        defaultValue={filters.document ?? ""}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2">
                      <Input
                        form="production-filters"
                        name="risk"
                        placeholder="Χαρακτηριστικό..."
                        defaultValue={filters.risk ?? ""}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2">
                      <Input
                        form="production-filters"
                        name="client"
                        placeholder="Πελάτης..."
                        defaultValue={filters.clientName ?? ""}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                    <TableHead className="pb-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length ? (
                    rows.map((row) => {
                      const phone = [row.phone_mobile, row.phone_landline].filter(Boolean).join(" / ");
                      const commission = commissionByMovement.get(row.id);
                      return (
                        <ClickableRow
                          key={row.id}
                          href={`/dashboard/policies/${row.policy_id}`}
                        >
                          <TableCell>{row.agent_name ?? "—"}</TableCell>
                          <TableCell>{row.policy_number}</TableCell>
                          <TableCell>{row.document_number ?? "—"}</TableCell>
                          <TableCell>{row.carrier_name ?? "—"}</TableCell>
                          <TableCell>{POLICY_MOVEMENT_KIND_LABELS[row.kind] ?? row.kind}</TableCell>
                          <TableCell>{row.line_name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.risk_label ?? "—"}</TableCell>
                          <TableCell>{formatDate(row.issue_date)}</TableCell>
                          <TableCell>{formatDate(row.start_date)}</TableCell>
                          <TableCell>{formatDate(row.end_date)}</TableCell>
                          <TableCell>{row.client_name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{phone || "—"}</TableCell>
                          <TableCell>{row.premium_gross.toFixed(2)} €</TableCell>
                          <TableCell>{row.premium_net != null ? `${row.premium_net.toFixed(2)} €` : "—"}</TableCell>
                          <TableCell>{commission != null ? `${commission.toFixed(2)} €` : "—"}</TableCell>
                        </ClickableRow>
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
          )}

          <form
            id="production-filters"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Button type="submit" variant="secondary" size="sm">
                Εφαρμογή φίλτρων
              </Button>
              <PageSizeSelect perPage={perPage} />
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/dashboard/reports/production"
              searchParams={{
                document: filters.document,
                policy_number: filters.policyNumber,
                risk: filters.risk,
                client: filters.clientName,
                agent: filters.agentIds?.join(","),
                carrier: filters.carrierId,
                line: filters.lineId,
                kind: filters.kinds?.join(","),
                issue_from: filters.issueFrom,
                issue_to: filters.issueTo,
                start_from: filters.startFrom,
                start_to: filters.startTo,
                sort: filters.sort,
                dir: filters.dir,
                per_page: sp.per_page,
              }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
