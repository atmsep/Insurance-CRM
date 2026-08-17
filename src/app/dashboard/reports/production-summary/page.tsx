import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { ListPageHeader } from "@/components/list-page-header";
import { ProductionFiltersPanel } from "../production/_components/production-filters-panel";
import { parseProductionFilters, parseGroupBy, GROUP_BY_OPTIONS, GROUP_BY_LABELS } from "./filters";
import { GroupedTable, type GroupedRow } from "./_components/grouped-table";

const FORM_ID = "production-summary-filters";

export default async function ProductionSummaryReportPage({
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
    status?: string;
    issue_from?: string;
    issue_to?: string;
    start_from?: string;
    start_to?: string;
    group_by?: string;
  }>;
}) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const filters = parseProductionFilters(sp);
  const groupBy = parseGroupBy(sp.group_by);
  const admin = createAdminClient();

  const [{ data: agents }, { data: carriers }, { data: insuranceLines }] = await Promise.all([
    admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    admin.from("carriers").select("id, name").order("name"),
    admin.from("insurance_lines").select("id, name_el").order("sort_order"),
  ]);

  const { data, error } = await admin.rpc("production_entries_grouped", {
    p_group_by: groupBy,
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
  });
  const rows = (data ?? []) as unknown as GroupedRow[];
  const labels = GROUP_BY_LABELS[groupBy];

  const exportParams = new URLSearchParams();
  exportParams.set("group_by", groupBy);
  if (filters.document) exportParams.set("document", filters.document);
  if (filters.policyNumber) exportParams.set("policy_number", filters.policyNumber);
  if (filters.risk) exportParams.set("risk", filters.risk);
  if (filters.clientName) exportParams.set("client", filters.clientName);
  if (filters.agentIds?.length) exportParams.set("agent", filters.agentIds.join(","));
  if (filters.carrierId) exportParams.set("carrier", filters.carrierId);
  if (filters.lineId) exportParams.set("line", filters.lineId);
  if (filters.kinds?.length) exportParams.set("kind", filters.kinds.join(","));
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.issueFrom) exportParams.set("issue_from", filters.issueFrom);
  if (filters.issueTo) exportParams.set("issue_to", filters.issueTo);
  if (filters.startFrom) exportParams.set("start_from", filters.startFrom);
  if (filters.startTo) exportParams.set("start_to", filters.startTo);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Παραγωγή Συγκεντρωτικά"
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/dashboard/reports/production-summary/export?${exportParams.toString()}`}>Εξαγωγή</a>}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <ProductionFiltersPanel
          form={FORM_ID}
          agents={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
          carriers={(carriers ?? []).map((c) => ({ id: c.id, label: c.name }))}
          insuranceLines={(insuranceLines ?? []).map((l) => ({ id: l.id, label: l.name_el }))}
          agentIds={filters.agentIds}
          carrierId={filters.carrierId}
          lineId={filters.lineId}
          kinds={filters.kinds}
          status={filters.status}
          issueFrom={filters.issueFrom}
          issueTo={filters.issueTo}
          startFrom={filters.startFrom}
          startTo={filters.startTo}
          groupByOptions={GROUP_BY_OPTIONS}
          groupBy={groupBy}
        />

        <div className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
              Σφάλμα κατά τη φόρτωση της παραγωγής. Δοκίμασε ξανά ή στένεψε τα φίλτρα.
            </div>
          ) : (
            <GroupedTable rows={rows} outerLabel={labels.outer} innerLabel={labels.inner} />
          )}

          <form id={FORM_ID} />
        </div>
      </div>
    </div>
  );
}
