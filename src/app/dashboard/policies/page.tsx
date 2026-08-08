import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";
import { Input } from "@/components/ui/input";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; expiring?: string }>;
}) {
  const { q, status, expiring } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("policies")
    .select(
      "id, policy_number, status, end_date, premium_gross, insurance_lines(name_el), carriers(name), clients(client_individuals(first_name,last_name), client_legal_entities(company_name))",
    )
    .limit(50);

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
  if (status) query = query.eq("status", status);

  const { data: policies } = await query;

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
        <Button nativeButton={false} render={<Link href="/dashboard/policies/new">Νέο συμβόλαιο</Link>} />
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <Input name="q" placeholder="Αναζήτηση με αριθμό συμβολαίου..." defaultValue={q ?? ""} className="max-w-xs" />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Όλες οι καταστάσεις</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Φίλτρο
        </Button>
      </form>

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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν συμβόλαια.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
