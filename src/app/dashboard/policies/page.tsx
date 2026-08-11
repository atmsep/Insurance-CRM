import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
import { formatDate } from "@/lib/date";
import { POLICY_STATUS_LABELS as STATUS_LABELS } from "./policy-labels";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import { QuickView, QuickViewField } from "@/components/quick-view";
import { ClickableRow } from "@/components/clickable-row";
import {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";
import { BulkStatusBar } from "@/components/bulk-status-bar";
import { bulkUpdatePolicyStatus } from "./actions";
import { getOutstandingByPolicy } from "./balance";
import { parsePolicyFilters, applyPolicyFilters, parsePerPage } from "./filters";
import { AdvancedPolicySearchSheet } from "./_components/advanced-policy-search-sheet";
import { PageSizeSelect } from "./_components/page-size-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    client?: string;
    line?: string;
    carrier?: string;
    status?: string;
    risk?: string;
    expiring?: string;
    agent?: string;
    broker_office?: string;
    start_from?: string;
    start_to?: string;
    end_from?: string;
    end_to?: string;
    premium_from?: string;
    premium_to?: string;
    per_page?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parsePolicyFilters(sp);
  const supabase = await createClient();
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = parsePerPage(sp.per_page);

  const [{ data: insuranceLines }, { data: carriers }, { data: brokerOffices }, agents] = await Promise.all([
    supabase.from("insurance_lines").select("id, name_el").order("sort_order"),
    supabase.from("carriers").select("id, name").order("name"),
    supabase.from("broker_offices").select("id, name").eq("is_active", true).order("name"),
    isAdmin
      ? (
          await supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
        ).data
      : null,
  ]);

  let query = supabase
    .from("policies")
    .select(
      "id, policy_number, status, issue_date, start_date, end_date, premium_gross, premium_net, risk_label, renewal_number, insurance_lines(name_el), carriers(name), clients!inner(display_name, client_individuals(first_name,last_name), client_legal_entities(company_name))",
      { count: "exact" },
    )
    .eq("is_current_term", true);

  query = filters.expiring
    ? query.order("end_date", { ascending: true })
    : query.order("created_at", { ascending: false });

  query = applyPolicyFilters(query, filters);

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data: policies, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));
  const outstandingByPolicy = await getOutstandingByPolicy(supabase, policies ?? []);

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.client) exportParams.set("client", filters.client);
  if (filters.line) exportParams.set("line", filters.line);
  if (filters.carrier) exportParams.set("carrier", filters.carrier);
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.risk) exportParams.set("risk", filters.risk);
  if (filters.expiring) exportParams.set("expiring", filters.expiring);
  if (filters.agentId) exportParams.set("agent", filters.agentId);
  if (filters.brokerOfficeId) exportParams.set("broker_office", filters.brokerOfficeId);
  if (filters.startFrom) exportParams.set("start_from", filters.startFrom);
  if (filters.startTo) exportParams.set("start_to", filters.startTo);
  if (filters.endFrom) exportParams.set("end_from", filters.endFrom);
  if (filters.endTo) exportParams.set("end_to", filters.endTo);
  if (filters.premiumFrom) exportParams.set("premium_from", filters.premiumFrom);
  if (filters.premiumTo) exportParams.set("premium_to", filters.premiumTo);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Συμβόλαια"
        filterBanner={
          filters.expiring
            ? {
                label: `Ενεργά συμβόλαια που λήγουν εντός ${Number(filters.expiring) || 30} ημερών`,
                clearHref: "/dashboard/policies",
              }
            : undefined
        }
        actions={
          <>
            <AdvancedPolicySearchSheet
              form="policy-filters"
              agentId={filters.agentId}
              brokerOfficeId={filters.brokerOfficeId}
              startFrom={filters.startFrom}
              startTo={filters.startTo}
              endFrom={filters.endFrom}
              endTo={filters.endTo}
              premiumFrom={filters.premiumFrom}
              premiumTo={filters.premiumTo}
              agents={agents?.map((a) => ({ id: a.id, label: a.full_name }))}
              brokerOffices={(brokerOffices ?? []).map((b) => ({ id: b.id, label: b.name }))}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={`/dashboard/policies/export?${exportParams.toString()}`}>Εξαγωγή</a>
              }
            />
            <Button nativeButton={false} render={<Link href="/dashboard/policies/new">Νέο συμβόλαιο</Link>} />
          </>
        }
      />

      <BulkSelectionProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <BulkSelectAllCheckbox ids={(policies ?? []).map((p) => p.id)} />
              </TableHead>
              <TableHead>Χαρακτ/κό</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Αριθμός</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Έκδοση</TableHead>
              <TableHead>Έναρξη</TableHead>
              <TableHead>Λήξη</TableHead>
              <TableHead>Μικτά</TableHead>
              <TableHead>Καθαρά</TableHead>
              <TableHead>Υπόλ.</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead className="w-8" />
            </TableRow>
            <TableRow>
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <Input
                  form="policy-filters"
                  name="risk"
                  placeholder="Χαρακτηριστικό..."
                  defaultValue={filters.risk ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="policy-filters"
                  name="client"
                  placeholder="Πελάτης..."
                  defaultValue={filters.client ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="policy-filters"
                  name="q"
                  placeholder="Αριθμός..."
                  defaultValue={filters.q ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="line"
                  defaultValue={filters.line ?? ""}
                  allLabel="Όλοι οι κλάδοι"
                  options={(insuranceLines ?? []).map((l) => ({ id: l.id, label: l.name_el }))}
                />
              </TableHead>
              <TableHead className="pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="carrier"
                  defaultValue={filters.carrier ?? ""}
                  allLabel="Όλες οι εταιρείες"
                  options={(carriers ?? []).map((c) => ({ id: c.id, label: c.name }))}
                />
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="status"
                  defaultValue={filters.status ?? ""}
                  allLabel="Όλες οι καταστάσεις"
                  options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ id: value, label }))}
                />
              </TableHead>
              <TableHead className="pb-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies?.length ? (
              policies.map((policy) => {
                const client = policy.clients as unknown as {
                  client_individuals: { first_name: string; last_name: string } | null;
                  client_legal_entities: { company_name: string } | null;
                } | null;
                const name = resolveClientName(client);
                const lineName = (policy.insurance_lines as unknown as { name_el: string } | null)?.name_el;
                const carrierName = (policy.carriers as unknown as { name: string } | null)?.name;
                const outstanding = outstandingByPolicy.get(policy.id);
                return (
                  <ClickableRow key={policy.id} href={`/dashboard/policies/${policy.id}`}>
                    <TableCell>
                      <BulkSelectCheckbox id={policy.id} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{policy.risk_label ?? "—"}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${policy.id}`} className="hover:underline">
                        {policy.policy_number}
                      </Link>
                      {policy.renewal_number > 1 && (
                        <Badge variant="outline" className="ml-2">
                          Ανανέωση #{policy.renewal_number}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{lineName}</TableCell>
                    <TableCell>{carrierName}</TableCell>
                    <TableCell>{policy.issue_date ? formatDate(policy.issue_date) : "—"}</TableCell>
                    <TableCell>{formatDate(policy.start_date)}</TableCell>
                    <TableCell>{formatDate(policy.end_date)}</TableCell>
                    <TableCell>{policy.premium_gross.toFixed(2)} €</TableCell>
                    <TableCell>
                      {policy.premium_net != null ? `${policy.premium_net.toFixed(2)} €` : "—"}
                    </TableCell>
                    <TableCell>{outstanding != null ? `${outstanding.toFixed(2)} €` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={policyStatusVariant(policy.status)}>
                        {STATUS_LABELS[policy.status] ?? policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <QuickView title={policy.policy_number} fullHref={`/dashboard/policies/${policy.id}`}>
                        <QuickViewField label="Χαρακτηριστικό" value={policy.risk_label} />
                        <QuickViewField label="Πελάτης" value={name} />
                        <QuickViewField label="Κλάδος" value={lineName} />
                        <QuickViewField label="Εταιρεία" value={carrierName} />
                        <QuickViewField
                          label="Έκδοση"
                          value={policy.issue_date ? formatDate(policy.issue_date) : undefined}
                        />
                        <QuickViewField label="Έναρξη" value={formatDate(policy.start_date)} />
                        <QuickViewField label="Λήξη" value={formatDate(policy.end_date)} />
                        <QuickViewField label="Μικτά" value={`${policy.premium_gross.toFixed(2)} €`} />
                        <QuickViewField
                          label="Καθαρά"
                          value={policy.premium_net != null ? `${policy.premium_net.toFixed(2)} €` : undefined}
                        />
                        <QuickViewField
                          label="Υπόλοιπο"
                          value={outstanding != null ? `${outstanding.toFixed(2)} €` : undefined}
                        />
                        {policy.renewal_number > 1 && (
                          <QuickViewField label="Αρ. Ανανέωσης" value={policy.renewal_number} />
                        )}
                        <QuickViewField
                          label="Κατάσταση"
                          value={
                            <Badge variant={policyStatusVariant(policy.status)}>
                              {STATUS_LABELS[policy.status] ?? policy.status}
                            </Badge>
                          }
                        />
                      </QuickView>
                    </TableCell>
                  </ClickableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν συμβόλαια.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BulkStatusBar
        statusOptions={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        applyAction={bulkUpdatePolicyStatus}
        exportBasePath="/dashboard/policies/export"
      />
      </BulkSelectionProvider>

      <form id="policy-filters" className="flex flex-wrap items-center justify-between gap-3">
        {filters.expiring && <input type="hidden" name="expiring" value={filters.expiring} />}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="sm">
            Εφαρμογή φίλτρων
          </Button>
          <PageSizeSelect perPage={perPage} />
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/dashboard/policies"
          searchParams={{
            q: filters.q,
            client: filters.client,
            line: filters.line,
            carrier: filters.carrier,
            status: filters.status,
            risk: filters.risk,
            expiring: filters.expiring,
            agent: filters.agentId,
            broker_office: filters.brokerOfficeId,
            start_from: filters.startFrom,
            start_to: filters.startTo,
            end_from: filters.endFrom,
            end_to: filters.endTo,
            premium_from: filters.premiumFrom,
            premium_to: filters.premiumTo,
            per_page: sp.per_page,
          }}
        />
      </form>
    </div>
  );
}
