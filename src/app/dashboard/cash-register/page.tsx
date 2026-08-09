import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

function clientLabel(policy: unknown) {
  const p = policy as { policy_number: string; clients: { display_name: string | null } | null } | null;
  return { number: p?.policy_number ?? "—", client: p?.clients?.display_name ?? "—" };
}

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; agent_id?: string }>;
}) {
  const { date, agent_id } = await searchParams;
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const dayStart = `${selectedDate}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const scopeAgentId = isAdmin ? agent_id || null : (agencyUser?.id ?? null);

  let collectionsQuery = supabase
    .from("policy_installments")
    .select(
      "id, policy_id, paid_amount, paid_at, receipt_number, payment_methods(name), paid_by, agency_users!policy_installments_paid_by_fkey(full_name), policies(policy_number, clients(display_name))",
    )
    .eq("paid_date", selectedDate)
    .in("status", ["paid", "partially_paid"])
    .order("paid_at", { ascending: true });
  if (scopeAgentId) collectionsQuery = collectionsQuery.eq("paid_by", scopeAgentId);

  let cancellationsQuery = supabase
    .from("policy_installments")
    .select(
      "id, policy_id, paid_amount, cancellation_reason, cancelled_at, paid_by, policies(policy_number, clients(display_name))",
    )
    .eq("status", "cancelled")
    .gte("cancelled_at", dayStart)
    .lt("cancelled_at", dayEnd)
    .order("cancelled_at", { ascending: true });
  if (scopeAgentId) cancellationsQuery = cancellationsQuery.eq("paid_by", scopeAgentId);

  const [{ data: collections }, { data: cancellations }, { data: agents }] = await Promise.all([
    collectionsQuery,
    cancellationsQuery,
    isAdmin
      ? supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const byMethod = new Map<string, number>();
  let grandTotal = 0;
  for (const c of collections ?? []) {
    const methodRow = c.payment_methods as unknown as { name: string } | { name: string }[] | null;
    const methodName = Array.isArray(methodRow) ? methodRow[0]?.name : methodRow?.name;
    const key = methodName ?? "Χωρίς μέθοδο";
    const amount = c.paid_amount ?? 0;
    byMethod.set(key, (byMethod.get(key) ?? 0) + amount);
    grandTotal += amount;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ταμείο</h1>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="date">
            Ημερομηνία
          </label>
          <Input id="date" name="date" type="date" defaultValue={selectedDate} className="w-40" />
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="agent_id">
              Συνεργάτης
            </label>
            <select
              id="agent_id"
              name="agent_id"
              defaultValue={agent_id ?? ""}
              className="h-8 rounded-md border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Όλοι</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή
        </Button>
      </form>

      <div className="flex flex-wrap gap-4">
        {[...byMethod.entries()].map(([method, amount]) => (
          <div key={method} className="rounded-md border px-4 py-2">
            <p className="text-xs text-muted-foreground">{method}</p>
            <p className="text-lg font-semibold">{amount.toFixed(2)} €</p>
          </div>
        ))}
        <div className="rounded-md border bg-muted px-4 py-2">
          <p className="text-xs text-muted-foreground">Σύνολο ημέρας</p>
          <p className="text-lg font-semibold">{grandTotal.toFixed(2)} €</p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ώρα</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Ποσό</TableHead>
              <TableHead>Μέθοδος</TableHead>
              <TableHead>Απόδειξη</TableHead>
              {isAdmin && <TableHead>Συνεργάτης</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections?.length ? (
              collections.map((c) => {
                const { number, client } = clientLabel(c.policies);
                const collectorRaw = c.agency_users as unknown as
                  | { full_name: string }
                  | { full_name: string }[]
                  | null;
                const collector = Array.isArray(collectorRaw) ? collectorRaw[0] : collectorRaw;
                const methodRaw = c.payment_methods as unknown as
                  | { name: string }
                  | { name: string }[]
                  | null;
                const method = Array.isArray(methodRaw) ? methodRaw[0] : methodRaw;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.paid_at ? formatTime(c.paid_at) : "—"}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${c.policy_id}`} className="hover:underline">
                        {number}
                      </Link>
                    </TableCell>
                    <TableCell>{client}</TableCell>
                    <TableCell>{(c.paid_amount ?? 0).toFixed(2)} €</TableCell>
                    <TableCell>{method?.name ?? "—"}</TableCell>
                    <TableCell>{c.receipt_number ?? "—"}</TableCell>
                    {isAdmin && <TableCell>{collector?.full_name ?? "—"}</TableCell>}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν εισπράξεις για αυτή την ημέρα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(cancellations?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Ακυρώσεις ημέρας</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ώρα</TableHead>
                  <TableHead>Συμβόλαιο</TableHead>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>Ποσό</TableHead>
                  <TableHead>Αιτιολογία</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancellations!.map((c) => {
                  const { number, client } = clientLabel(c.policies);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.cancelled_at ? formatTime(c.cancelled_at) : "—"}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/policies/${c.policy_id}`} className="hover:underline">
                          {number}
                        </Link>
                      </TableCell>
                      <TableCell>{client}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{(c.paid_amount ?? 0).toFixed(2)} €</Badge>
                      </TableCell>
                      <TableCell>{c.cancellation_reason ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
