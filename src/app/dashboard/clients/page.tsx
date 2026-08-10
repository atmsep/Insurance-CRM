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
import { AdvancedSearchSheet } from "./_components/advanced-search-sheet";
import { PageSizeSelect } from "./_components/page-size-select";
import { parseClientFilters, applyClientFilters, needsIndividualJoin, parsePerPage } from "./filters";

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
    per_page?: string;
    page?: string;
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

  let query = supabase
    .from("clients")
    .select(
      `id, client_code, client_type, afm, phone_mobile, address_city, is_active, ${individualSelect}, client_legal_entities(company_name)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  query = applyClientFilters(query, filters);

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data: clients, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

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
                <TableHead>Κωδ.</TableHead>
                <TableHead>Ονομα / Επωνυμία</TableHead>
                <TableHead>ΑΦΜ</TableHead>
                <TableHead>Τηλέφωνο</TableHead>
                <TableHead>Πόλη</TableHead>
                <TableHead>Κατάσταση</TableHead>
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
                    <TableRow key={client.id} className="cursor-pointer">
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
                      <TableCell>{client.phone_mobile ?? "—"}</TableCell>
                      <TableCell>{client.address_city ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? "success" : "outline"}>
                          {client.is_active ? "Ενεργός" : "Ανενεργός"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <QuickView title={name} fullHref={`/dashboard/clients/${client.id}`}>
                          <QuickViewField label="Κωδικός" value={`#${client.client_code}`} />
                          <QuickViewField label="ΑΦΜ" value={client.afm} />
                          <QuickViewField label="Τηλέφωνο" value={client.phone_mobile} />
                          <QuickViewField label="Πόλη" value={client.address_city} />
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
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Δεν βρέθηκαν πελάτες.
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
          <PageSizeSelect perPage={perPage} />
        </div>
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
            per_page: sp.per_page,
          }}
        />
      </form>
    </div>
  );
}
