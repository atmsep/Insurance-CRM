import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
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
  return new Date(value).toLocaleTimeString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });
}

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type PolicyEmbed = SingleOrMany<{
  policy_id: string;
  amount: number;
  policies: SingleOrMany<{ policy_number: string; clients: SingleOrMany<{ display_name: string | null }> }>;
}>;

type CollectionRow = {
  id: string;
  installment_id: string;
  amount: number;
  paid_at: string;
  receipt_number: string | null;
  paid_by: string | null;
  cheque_bank: string | null;
  cheque_number: string | null;
  cheque_due_date: string | null;
  payment_methods: SingleOrMany<{ name: string }>;
  agency_users: SingleOrMany<{ full_name: string }>;
  policy_installments: PolicyEmbed;
};

type ReversalRow = {
  id: string;
  installment_id: string;
  amount: number;
  reversal_reason: string | null;
  reversed_at: string | null;
  paid_by: string | null;
  policy_installments: PolicyEmbed;
};

function clientLabel(installment: PolicyEmbed) {
  const pi = one(installment);
  const policy = one(pi?.policies ?? null);
  const client = one(policy?.clients ?? null);
  return { number: policy?.policy_number ?? "—", client: client?.display_name ?? "—" };
}

// This page existed before (commit 068c310 removed it, data untouched, as
// part of the Profia-rebuild cleanup) — this is a restoration, not a new
// design. See the plan for why it reads via the admin client instead of the
// original's plain server client: installment_payments_select RLS has the
// exact same exists()-subquery-over-policies shape that already caused two
// real statement timeouts elsewhere in this schema (migrations 0066, 0077).
// Per-agent scoping is enforced in the query itself (scopeAgentId below),
// not by RLS, same as every admin-client report page this session.
export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; agent_id?: string }>;
}) {
  const { date, agent_id } = await searchParams;
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  const dayStart = `${selectedDate}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const scopeAgentId = isAdmin ? agent_id || null : agencyUser.id;

  // Every collection is its own row here — a partial payment and its later
  // top-up are two separate transactions, not one merged total.
  let collectionsQuery = admin
    .from("installment_payments")
    .select(
      "id, installment_id, amount, paid_at, receipt_number, paid_by, cheque_bank, cheque_number, cheque_due_date, " +
        "payment_methods(name), agency_users!installment_payments_paid_by_fkey(full_name), " +
        "policy_installments!inner(policy_id, amount, policies(policy_number, clients(display_name)))",
    )
    .eq("paid_date", selectedDate)
    .eq("is_reversed", false)
    .order("paid_at", { ascending: true });
  if (scopeAgentId) collectionsQuery = collectionsQuery.eq("paid_by", scopeAgentId);

  let reversalsQuery = admin
    .from("installment_payments")
    .select(
      "id, installment_id, amount, reversal_reason, reversed_at, paid_by, " +
        "policy_installments!inner(policy_id, policies(policy_number, clients(display_name)))",
    )
    .eq("is_reversed", true)
    .gte("reversed_at", dayStart)
    .lt("reversed_at", dayEnd)
    .order("reversed_at", { ascending: true });
  if (scopeAgentId) reversalsQuery = reversalsQuery.eq("paid_by", scopeAgentId);

  const [{ data: rawCollections, error }, { data: rawReversals }, { data: agents }] = await Promise.all([
    collectionsQuery,
    reversalsQuery,
    isAdmin
      ? admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  const collections = (rawCollections ?? []) as unknown as CollectionRow[];
  const reversals = (rawReversals ?? []) as unknown as ReversalRow[];

  // A tip is whatever a transaction collects beyond what was still owed on
  // its installment at that point — computed from the full chronological
  // history of active payments on each touched installment (not just
  // today's), so a tip is attributed to the specific transaction that
  // actually pushed the balance over, however many payments came before it.
  const touchedIds = [...new Set(collections.map((c) => c.installment_id))];
  const amountOwedByInstallment = new Map<string, number>();
  for (const c of collections) {
    const pi = one(c.policy_installments);
    if (pi) amountOwedByInstallment.set(c.installment_id, pi.amount);
  }
  const { data: fullHistory } =
    touchedIds.length > 0
      ? await admin
          .from("installment_payments")
          .select("id, installment_id, amount, paid_at")
          .in("installment_id", touchedIds)
          .eq("is_reversed", false)
          .order("paid_at", { ascending: true })
      : { data: [] };

  const tipByPaymentId = new Map<string, number>();
  const cumulativeByInstallment = new Map<string, number>();
  for (const p of fullHistory ?? []) {
    const amountOwed = amountOwedByInstallment.get(p.installment_id) ?? 0;
    const before = cumulativeByInstallment.get(p.installment_id) ?? 0;
    const remainingBefore = Math.max(amountOwed - before, 0);
    tipByPaymentId.set(p.id, Math.max(p.amount - remainingBefore, 0));
    cumulativeByInstallment.set(p.installment_id, before + p.amount);
  }

  const byMethod = new Map<string, number>();
  let grandTotal = 0;
  let tipsTotal = 0;
  for (const c of collections) {
    const method = one(c.payment_methods);
    const key = method?.name ?? "Χωρίς μέθοδο";
    byMethod.set(key, (byMethod.get(key) ?? 0) + c.amount);
    grandTotal += c.amount;
    tipsTotal += tipByPaymentId.get(c.id) ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ταμείο</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/cash-register/calendar">Ημερολόγιο</Link>}
        />
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

      {error ? (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
          Σφάλμα κατά τη φόρτωση του ταμείου. Δοκίμασε ξανά.
        </div>
      ) : (
        <>
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
            {tipsTotal > 0 && (
              <div className="rounded-md border px-4 py-2">
                <p className="text-xs text-muted-foreground">Φιλοδωρήματα ημέρας</p>
                <p className="text-lg font-semibold">{tipsTotal.toFixed(2)} €</p>
              </div>
            )}
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
                {collections.length ? (
                  collections.map((c) => {
                    const { number, client } = clientLabel(c.policy_installments);
                    const collector = one(c.agency_users);
                    const method = one(c.payment_methods);
                    const tip = tipByPaymentId.get(c.id) ?? 0;
                    const isCheque = Boolean(c.cheque_bank || c.cheque_number || c.cheque_due_date);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{c.paid_at ? formatTime(c.paid_at) : "—"}</TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/policies/${one(c.policy_installments)?.policy_id}`}
                            className="hover:underline"
                          >
                            {number}
                          </Link>
                        </TableCell>
                        <TableCell>{client}</TableCell>
                        <TableCell>
                          <div>{c.amount.toFixed(2)} €</div>
                          {tip > 0 && (
                            <div className="text-xs text-muted-foreground">+ {tip.toFixed(2)} € tip</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{method?.name ?? "—"}</div>
                          {isCheque && (
                            <div className="text-xs text-muted-foreground">
                              {[c.cheque_bank, c.cheque_number, c.cheque_due_date].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </TableCell>
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

          {reversals.length > 0 && (
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
                    {reversals.map((c) => {
                      const { number, client } = clientLabel(c.policy_installments);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{c.reversed_at ? formatTime(c.reversed_at) : "—"}</TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/policies/${one(c.policy_installments)?.policy_id}`}
                              className="hover:underline"
                            >
                              {number}
                            </Link>
                          </TableCell>
                          <TableCell>{client}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.amount.toFixed(2)} €</Badge>
                          </TableCell>
                          <TableCell>{c.reversal_reason ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
