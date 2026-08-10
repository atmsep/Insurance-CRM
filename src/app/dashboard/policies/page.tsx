import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import { QuickView, QuickViewField } from "@/components/quick-view";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
};

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

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
    page?: string;
  }>;
}) {
  const { q, client, line, carrier, status, risk, expiring, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ data: insuranceLines }, { data: carriers }] = await Promise.all([
    supabase.from("insurance_lines").select("id, name_el").order("sort_order"),
    supabase.from("carriers").select("id, name").order("name"),
  ]);

  let query = supabase
    .from("policies")
    .select(
      "id, policy_number, status, end_date, premium_gross, risk_label, renewal_number, insurance_lines(name_el), carriers(name), clients!inner(display_name, client_individuals(first_name,last_name), client_legal_entities(company_name))",
      { count: "exact" },
    )
    .eq("is_current_term", true);

  if (expiring) {
    const days = Number(expiring) || 30;
    const until = new Date();
    until.setDate(until.getDate() + days);
    query = query
      .eq("status", "active")
      .lte("end_date", until.toISOString().slice(0, 10))
      .order("end_date", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (q) query = query.ilike("policy_number", `%${q}%`);
  if (client) query = query.ilike("clients.display_name", `%${client}%`);
  if (line) query = query.eq("insurance_line_id", line);
  if (carrier) query = query.eq("carrier_id", carrier);
  if (status) query = query.eq("status", status);
  if (risk) query = query.ilike("risk_label", `%${risk}%`);

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: policies, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (client) exportParams.set("client", client);
  if (line) exportParams.set("line", line);
  if (carrier) exportParams.set("carrier", carrier);
  if (status) exportParams.set("status", status);
  if (risk) exportParams.set("risk", risk);
  if (expiring) exportParams.set("expiring", expiring);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Συμβόλαια"
        filterBanner={
          expiring
            ? {
                label: `Ενεργά συμβόλαια που λήγουν εντός ${Number(expiring) || 30} ημερών`,
                clearHref: "/dashboard/policies",
              }
            : undefined
        }
        actions={
          <>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αριθμός</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Λήξη</TableHead>
              <TableHead>Ασφάλιστρο</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead className="w-8" />
            </TableRow>
            <TableRow>
              <TableHead className="pb-2">
                <Input
                  form="policy-filters"
                  name="q"
                  placeholder="Αριθμός..."
                  defaultValue={q ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <Input
                  form="policy-filters"
                  name="client"
                  placeholder="Πελάτης..."
                  defaultValue={client ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="space-y-1 pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="line"
                  defaultValue={line ?? ""}
                  allLabel="Όλοι οι κλάδοι"
                  options={(insuranceLines ?? []).map((l) => ({ id: l.id, label: l.name_el }))}
                />
                <Input
                  form="policy-filters"
                  name="risk"
                  placeholder="Κίνδυνος..."
                  defaultValue={risk ?? ""}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="carrier"
                  defaultValue={carrier ?? ""}
                  allLabel="Όλες οι εταιρείες"
                  options={(carriers ?? []).map((c) => ({ id: c.id, label: c.name }))}
                />
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <FilterSelect
                  form="policy-filters"
                  name="status"
                  defaultValue={status ?? ""}
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
                return (
                  <TableRow key={policy.id} className="cursor-pointer hover:bg-muted/50">
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
                    <TableCell>{name}</TableCell>
                    <TableCell>{lineName}</TableCell>
                    <TableCell>{carrierName}</TableCell>
                    <TableCell>{formatDate(policy.end_date)}</TableCell>
                    <TableCell>{policy.premium_gross.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Badge variant={policyStatusVariant(policy.status)}>
                        {STATUS_LABELS[policy.status] ?? policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <QuickView title={policy.policy_number} fullHref={`/dashboard/policies/${policy.id}`}>
                        <QuickViewField label="Πελάτης" value={name} />
                        <QuickViewField label="Κλάδος" value={lineName} />
                        <QuickViewField label="Εταιρεία" value={carrierName} />
                        <QuickViewField label="Λήξη" value={formatDate(policy.end_date)} />
                        <QuickViewField label="Ασφάλιστρο" value={`${policy.premium_gross.toFixed(2)} €`} />
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
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν συμβόλαια.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form id="policy-filters" className="flex flex-wrap items-center justify-between gap-3">
        {expiring && <input type="hidden" name="expiring" value={expiring} />}
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/dashboard/policies"
          searchParams={{ q, client, line, carrier, status, risk, expiring }}
        />
      </form>
    </div>
  );
}
