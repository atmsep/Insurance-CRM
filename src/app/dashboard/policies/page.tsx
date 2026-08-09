import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
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

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function riskLabel(policy: {
  policy_vehicle_details: unknown;
  policy_property_details: unknown;
  policy_life_health_details: unknown;
}): string {
  const vehicle = one(
    policy.policy_vehicle_details as
      | { plate_number: string | null; make: string | null; model: string | null }
      | { plate_number: string | null; make: string | null; model: string | null }[]
      | null,
  );
  if (vehicle) {
    const brand = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
    if (vehicle.plate_number && brand) return `${vehicle.plate_number} – ${brand}`;
    return vehicle.plate_number || brand || "—";
  }

  const property = one(
    policy.policy_property_details as
      | { address_street: string | null; address_city: string | null }
      | { address_street: string | null; address_city: string | null }[]
      | null,
  );
  if (property) {
    const address = [property.address_street, property.address_city].filter(Boolean).join(", ");
    return address || "—";
  }

  const lifeHealth = one(
    policy.policy_life_health_details as
      | { coverage_type: string | null }
      | { coverage_type: string | null }[]
      | null,
  );
  if (lifeHealth) return lifeHealth.coverage_type || "—";

  return "—";
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
    expiring?: string;
    page?: string;
  }>;
}) {
  const { q, client, line, carrier, status, expiring, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ data: insuranceLines }, { data: carriers }] = await Promise.all([
    supabase.from("insurance_lines").select("id, name_el").order("sort_order"),
    supabase.from("carriers").select("id, name").order("name"),
  ]);

  let query = supabase
    .from("policies")
    .select(
      "id, policy_number, status, end_date, premium_gross, insurance_lines(name_el), carriers(name), clients!inner(display_name, client_individuals(first_name,last_name), client_legal_entities(company_name)), policy_vehicle_details(plate_number, make, model), policy_property_details(address_street, address_city), policy_life_health_details(coverage_type)",
      { count: "exact" },
    );

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
  if (expiring) exportParams.set("expiring", expiring);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Συμβόλαια</h1>
          {expiring && (
            <p className="text-sm text-muted-foreground">
              Ενεργά συμβόλαια που λήγουν εντός {Number(expiring) || 30} ημερών ·{" "}
              <Link href="/dashboard/policies" className="hover:underline">
                Καθαρισμός φίλτρου
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={`/dashboard/policies/export?${exportParams.toString()}`}>Εξαγωγή</a>
            }
          />
          <Button nativeButton={false} render={<Link href="/dashboard/policies/new">Νέο συμβόλαιο</Link>} />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αριθμός</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Κίνδυνος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Λήξη</TableHead>
              <TableHead>Ασφάλιστρο</TableHead>
              <TableHead>Κατάσταση</TableHead>
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
              <TableHead className="pb-2">
                <select
                  form="policy-filters"
                  name="line"
                  defaultValue={line ?? ""}
                  className="h-7 w-full rounded-md border border-input bg-transparent px-1.5 text-xs"
                >
                  <option value="">Όλοι</option>
                  {(insuranceLines ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name_el}
                    </option>
                  ))}
                </select>
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <select
                  form="policy-filters"
                  name="carrier"
                  defaultValue={carrier ?? ""}
                  className="h-7 w-full rounded-md border border-input bg-transparent px-1.5 text-xs"
                >
                  <option value="">Όλες</option>
                  {(carriers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </TableHead>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <div className="flex items-center gap-1">
                  <select
                    form="policy-filters"
                    name="status"
                    defaultValue={status ?? ""}
                    className="h-7 w-full rounded-md border border-input bg-transparent px-1.5 text-xs"
                  >
                    <option value="">Όλες</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies?.length ? (
              policies.map((policy) => {
                const client = policy.clients as unknown as {
                  client_individuals: { first_name: string; last_name: string } | null;
                  client_legal_entities: { company_name: string } | null;
                } | null;
                const name = client?.client_individuals
                  ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
                  : client?.client_legal_entities?.company_name ?? "—";
                return (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <Link href={`/dashboard/policies/${policy.id}`} className="hover:underline">
                        {policy.policy_number}
                      </Link>
                    </TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      {(policy.insurance_lines as unknown as { name_el: string } | null)?.name_el}
                    </TableCell>
                    <TableCell>{riskLabel(policy)}</TableCell>
                    <TableCell>{(policy.carriers as unknown as { name: string } | null)?.name}</TableCell>
                    <TableCell>{formatDate(policy.end_date)}</TableCell>
                    <TableCell>{policy.premium_gross.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Badge variant={policyStatusVariant(policy.status)}>
                        {STATUS_LABELS[policy.status] ?? policy.status}
                      </Badge>
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
          searchParams={{ q, client, line, carrier, status, expiring }}
        />
      </form>
    </div>
  );
}
