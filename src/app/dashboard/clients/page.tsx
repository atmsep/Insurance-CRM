import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { resolveClientName } from "@/lib/client-name";
import { ListPageHeader } from "@/components/list-page-header";
import {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
  BulkActionsBar,
} from "./bulk-actions-bar";
import { deactivateClients } from "./actions";
import { QuickView, QuickViewField } from "@/components/quick-view";
import { ClickableRow } from "@/components/clickable-row";
import { SortableHeader } from "@/components/sortable-header";
import { AdvancedSearchSheet } from "./_components/advanced-search-sheet";
import { PageSizeSelect } from "./_components/page-size-select";
import { parseClientFilters, applyClientFilters, needsIndividualJoin, parsePerPage } from "./filters";

type ClientListRow = {
  id: string;
  client_code: number;
  client_type: string;
  afm: string | null;
  phone_mobile: string | null;
  phone_landline: string | null;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  assigned_agent_id: string | null;
  is_active: boolean;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
  agency_users: { full_name: string } | null;
};

// See policies/page.tsx SORTABLE_COLUMNS for why joined columns use the
// `"table(column)"` embed-path form instead of supabase-js's
// `{ referencedTable }` option.
const SORTABLE_COLUMNS: Record<string, { column: string }> = {
  code: { column: "client_code" },
  name: { column: "display_name" },
  afm: { column: "afm" },
  phone: { column: "phone_mobile" },
  city: { column: "address_city" },
  agent: { column: "agency_users(full_name)" },
  status: { column: "is_active" },
};

function formatAddress(client: ClientListRow): string {
  const streetLine = [client.address_street, client.address_number].filter(Boolean).join(" ");
  const parts = [streetLine, client.address_city].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    name?: string;
    afm?: string;
    phone?: string;
    city?: string;
    email?: string;
    region?: string;
    postal_code?: string;
    agent?: string;
    client_type?: string;
    dob_from?: string;
    dob_to?: string;
    show_inactive?: string;
    sort?: string;
    dir?: string;
    per_page?: string;
    page?: string;
    all?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parseClientFilters(sp);
  const supabase = await createClient();
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = parsePerPage(sp.per_page);

  const agents = isAdmin
    ? (
        await supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      ).data
    : null;

  const individualSelect = needsIndividualJoin(filters)
    ? "client_individuals!inner(first_name,last_name)"
    : "client_individuals(first_name,last_name)";

  // Default landing view: the 50 clients this user last opened, most
  // recent first — no pagination, driven by client_visits (not activity_log,
  // which only records mutations, never page views). Applying any filter,
  // or the explicit "Προβολή όλων" escape hatch (?all=1), switches back to
  // the full filtered/paginated directory below. hasAnyFilter is computed
  // from the already-parsed `filters` (empty-string params normalize to
  // undefined there), so submitting the filter form with every field blank
  // still lands on the recent-visits view instead of looking like a no-op.
  const hasAnyFilter = Boolean(
    filters.code ||
      filters.name ||
      filters.afm ||
      filters.phone ||
      filters.city ||
      filters.email ||
      filters.region ||
      filters.postalCode ||
      filters.agentId ||
      filters.clientType ||
      filters.dobFrom ||
      filters.dobTo ||
      filters.showInactive ||
      filters.sort,
  );
  const showAll = sp.all === "1";
  const useRecent = !hasAnyFilter && !showAll;

  let clients: ClientListRow[] = [];
  let totalPages = 1;

  if (useRecent) {
    const { data: visits } = await supabase
      .from("client_visits")
      .select(
        "visited_at, clients(id, client_code, client_type, afm, phone_mobile, phone_landline, address_street, address_number, address_city, assigned_agent_id, is_active, client_individuals(first_name,last_name), client_legal_entities(company_name), agency_users!clients_assigned_agent_id_fkey(full_name))",
      )
      .eq("agency_user_id", agencyUser?.id ?? "")
      .order("visited_at", { ascending: false })
      .limit(50);
    clients = (visits ?? []).map((v) => v.clients).filter(Boolean) as unknown as ClientListRow[];
  } else {
    let query = supabase
      .from("clients")
      .select(
        `id, client_code, client_type, afm, phone_mobile, phone_landline, address_street, address_number, address_city, assigned_agent_id, is_active, ${individualSelect}, client_legal_entities(company_name), agency_users!clients_assigned_agent_id_fkey(full_name)`,
        { count: "exact" },
      );

    const sortable = filters.sort ? SORTABLE_COLUMNS[filters.sort] : undefined;
    query = sortable
      ? query.order(sortable.column, { ascending: filters.dir !== "desc" })
      : query.order("created_at", { ascending: false });

    query = applyClientFilters(query, filters);

    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data, count } = await query;
    clients = (data ?? []) as unknown as ClientListRow[];
    totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));
  }

  const exportParams = new URLSearchParams();
  if (filters.code) exportParams.set("code", filters.code);
  if (filters.name) exportParams.set("name", filters.name);
  if (filters.afm) exportParams.set("afm", filters.afm);
  if (filters.phone) exportParams.set("phone", filters.phone);
  if (filters.city) exportParams.set("city", filters.city);
  if (filters.email) exportParams.set("email", filters.email);
  if (filters.region) exportParams.set("region", filters.region);
  if (filters.postalCode) exportParams.set("postal_code", filters.postalCode);
  if (filters.agentId) exportParams.set("agent", filters.agentId);
  if (filters.clientType) exportParams.set("client_type", filters.clientType);
  if (filters.dobFrom) exportParams.set("dob_from", filters.dobFrom);
  if (filters.dobTo) exportParams.set("dob_to", filters.dobTo);
  if (filters.showInactive) exportParams.set("show_inactive", "1");

  const clientIds = (clients ?? []).map((c) => c.id);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Πελάτες"
        actions={
          <>
            <AdvancedSearchSheet
              form="client-filters"
              city={filters.city}
              email={filters.email}
              region={filters.region}
              postalCode={filters.postalCode}
              agentId={filters.agentId}
              clientType={filters.clientType}
              dobFrom={filters.dobFrom}
              dobTo={filters.dobTo}
              agents={agents ?? undefined}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/dashboard/clients/export?${exportParams.toString()}`}>Εξαγωγή</a>}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/clients/import">Εισαγωγή από CSV</Link>}
            />
            <Button nativeButton={false} render={<Link href="/dashboard/clients/new">Νέος πελάτης</Link>} />
          </>
        }
      />

      <BulkSelectionProvider>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <BulkSelectAllCheckbox ids={clientIds} />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="code" label="Κωδ." />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="name" label="Ονομα / Επωνυμία" />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="afm" label="ΑΦΜ" />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="phone" label="Τηλέφωνα" />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="city" label="Διεύθυνση" />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="agent" label="Συνεργάτης" />
                </TableHead>
                <TableHead>
                  <SortableHeader sortKey="status" label="Κατάσταση" />
                </TableHead>
                <TableHead className="w-8" />
              </TableRow>
              <TableRow>
                <TableHead className="pb-2" />
                <TableHead className="pb-2">
                  <Input
                    form="client-filters"
                    name="code"
                    placeholder="Κωδ...."
                    defaultValue={filters.code ?? ""}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead className="pb-2">
                  <Input
                    form="client-filters"
                    name="name"
                    placeholder="Όνομα..."
                    defaultValue={filters.name ?? ""}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead className="pb-2">
                  <Input
                    form="client-filters"
                    name="afm"
                    placeholder="ΑΦΜ..."
                    defaultValue={filters.afm ?? ""}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead className="pb-2">
                  <Input
                    form="client-filters"
                    name="phone"
                    placeholder="Τηλέφωνο..."
                    defaultValue={filters.phone ?? ""}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead className="pb-2" />
                <TableHead className="pb-2" />
                <TableHead className="pb-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      form="client-filters"
                      type="checkbox"
                      name="show_inactive"
                      value="1"
                      defaultChecked={filters.showInactive}
                      className="size-3.5"
                    />
                    Ανενεργοί
                  </label>
                </TableHead>
                <TableHead className="pb-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients?.length ? (
                clients.map((client) => {
                  const name = resolveClientName(client as never);
                  return (
                    <ClickableRow key={client.id} href={`/dashboard/clients/${client.id}`}>
                      <TableCell>
                        <BulkSelectCheckbox id={client.id} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">#{client.client_code}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                          {name}
                        </Link>
                      </TableCell>
                      <TableCell>{client.afm ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{client.phone_mobile ?? "—"}</span>
                          {client.phone_landline && (
                            <span className="text-xs text-muted-foreground">{client.phone_landline}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatAddress(client)}</TableCell>
                      <TableCell>{client.agency_users?.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? "success" : "outline"}>
                          {client.is_active ? "Ενεργός" : "Ανενεργός"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <QuickView title={name} fullHref={`/dashboard/clients/${client.id}`}>
                          <QuickViewField label="Κωδικός" value={`#${client.client_code}`} />
                          <QuickViewField label="ΑΦΜ" value={client.afm} />
                          <QuickViewField label="Κινητό" value={client.phone_mobile} />
                          <QuickViewField label="Σταθερό" value={client.phone_landline} />
                          <QuickViewField label="Διεύθυνση" value={formatAddress(client)} />
                          <QuickViewField label="Συνεργάτης" value={client.agency_users?.full_name} />
                          <QuickViewField
                            label="Κατάσταση"
                            value={
                              <Badge variant={client.is_active ? "success" : "outline"}>
                                {client.is_active ? "Ενεργός" : "Ανενεργός"}
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
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {useRecent ? "Δεν έχετε επισκεφθεί ακόμα κανέναν πελάτη." : "Δεν βρέθηκαν πελάτες."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <BulkActionsBar deactivateAction={deactivateClients} exportBasePath="/dashboard/clients/export" />
      </BulkSelectionProvider>

      <form id="client-filters" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="sm">
            Εφαρμογή φίλτρων
          </Button>
          {!useRecent && <PageSizeSelect perPage={perPage} />}
        </div>
        {useRecent ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Τελευταίοι {clients.length} πελάτες που επισκεφθήκατε</span>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/clients?all=1">Προβολή όλων</Link>}
            />
          </div>
        ) : (
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/dashboard/clients"
            searchParams={{
              code: filters.code,
              name: filters.name,
              afm: filters.afm,
              phone: filters.phone,
              city: filters.city,
              email: filters.email,
              region: filters.region,
              postal_code: filters.postalCode,
              agent: filters.agentId,
              client_type: filters.clientType,
              dob_from: filters.dobFrom,
              dob_to: filters.dobTo,
              show_inactive: filters.showInactive ? "1" : undefined,
              sort: filters.sort,
              dir: filters.dir,
              per_page: sp.per_page,
              all: showAll ? "1" : undefined,
            }}
          />
        )}
      </form>
    </div>
  );
}
