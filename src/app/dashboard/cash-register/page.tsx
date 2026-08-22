import Link from "next/link";
import { getActiveAgentsCached, getPaymentMethodsCached } from "@/lib/cached-queries/lookups";
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
import { POLICY_MOVEMENT_KIND_LABELS } from "../policies/movement-labels";
import { installmentRemaining } from "../policies/balance";
import { formatDate, athensToday, athensDayStartUtc, athensNextDayStartUtc } from "@/lib/date";
import { CollectFromCashRegister } from "./_components/collect-from-cash-register";
import { ReversePaymentButton } from "./_components/reverse-payment-button";
import { PrintButton } from "@/components/print-button";
import { ReportPrintHeader } from "../reports/_components/report-print-header";

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
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
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
  const carrier = one(policy?.carriers ?? null);
  const line = one(policy?.insurance_lines ?? null);
  return {
    number: policy?.policy_number ?? "—",
    client: client?.display_name ?? "—",
    riskLabel: policy?.risk_label ?? "—",
    carrier: carrier?.name ?? "—",
    line: line?.name_el ?? "—",
  };
}

type MovementRow = {
  id: string;
  kind: string;
  premium_gross: number;
  policy_id: string;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
};

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
  const selectedDate = date || athensToday();
  const admin = createAdminClient();

  const dayStart = athensDayStartUtc(selectedDate);
  const dayEnd = athensNextDayStartUtc(selectedDate);

  const scopeAgentId = isAdmin ? agent_id || null : agencyUser.id;

  // Every collection is its own row here — a partial payment and its later
  // top-up are two separate transactions, not one merged total.
  let collectionsQuery = admin
    .from("installment_payments")
    .select(
      "id, installment_id, amount, paid_at, receipt_number, paid_by, cheque_bank, cheque_number, cheque_due_date, " +
        "payment_methods(name), agency_users!installment_payments_paid_by_fkey(full_name), " +
        "policy_installments!inner(policy_id, amount, policies(policy_number, risk_label, clients(display_name), " +
        "carriers(name), insurance_lines(name_el)))",
    )
    .eq("paid_date", selectedDate)
    .eq("is_reversed", false)
    .order("paid_at", { ascending: true });
  if (scopeAgentId) collectionsQuery = collectionsQuery.eq("paid_by", scopeAgentId);

  let reversalsQuery = admin
    .from("installment_payments")
    .select(
      "id, installment_id, amount, reversal_reason, reversed_at, paid_by, " +
        "policy_installments!inner(policy_id, policies(policy_number, risk_label, clients(display_name), " +
        "carriers(name), insurance_lines(name_el)))",
    )
    .eq("is_reversed", true)
    .gte("reversed_at", dayStart)
    .lt("reversed_at", dayEnd)
    .order("reversed_at", { ascending: true });
  if (scopeAgentId) reversalsQuery = reversalsQuery.eq("paid_by", scopeAgentId);

  // Movements (κινήσεις) issued today are a separate thing from
  // collections above: a movement can exist with nothing collected on it
  // yet ("ανείσπρακτη"). Scoped through the underlying policy's assigned
  // agent, same as policy_movements_select RLS would (this query bypasses
  // it via the admin client, same rationale as everywhere else on this
  // page).
  let movementsQuery = admin
    .from("policy_movements")
    .select(
      "id, kind, premium_gross, policy_id, " +
        "policies!inner(policy_number, risk_label, assigned_agent_id, clients(display_name), " +
        "agency_users!policies_assigned_agent_id_fkey(full_name), carriers(name), insurance_lines(name_el))",
    )
    .eq("issue_date", selectedDate)
    .order("created_at", { ascending: true });
  if (scopeAgentId) movementsQuery = movementsQuery.eq("policies.assigned_agent_id", scopeAgentId);

  // Τα μόνιμα ανείσπρακτα έφυγαν σε δική τους σελίδα (/dashboard/uncollected):
  // δεν είναι δουλειά της ημέρας και φόρτωναν έως 10.000 γραμμές σε κάθε
  // άνοιγμα του Ταμείου. Εδώ μένει μόνο ό,τι αφορά την επιλεγμένη ημέρα.

  const [
    { data: rawCollections, error },
    { data: rawReversals },
    agents,
    { data: rawMovements },
    paymentMethods,
  ] = await Promise.all([
    collectionsQuery,
    reversalsQuery,
    // Ρυθμίσεις γραφείου, όχι δεδομένα: cached (lib/cached-queries/lookups.ts).
    isAdmin ? getActiveAgentsCached() : Promise.resolve([]),
    movementsQuery,
    getPaymentMethodsCached(),
  ]);
  const collections = (rawCollections ?? []) as unknown as CollectionRow[];
  const reversals = (rawReversals ?? []) as unknown as ReversalRow[];
  const movements = (rawMovements ?? []) as unknown as MovementRow[];

  // A movement's receivable lives on its installments (amount/paid_amount/
  // status, kept in sync by installment_payments_recompute) — "ανείσπρακτο"
  // is whatever's still owed across the ones that aren't fully paid or
  // cancelled. Kept per-installment (not just summed) so each one can get
  // its own "Είσπραξη" button below — a movement split into several δόσεις
  // is collected one δόση at a time, same as everywhere else in the app.
  const movementIds = movements.map((m) => m.id);
  const { data: rawMovementInstallments } =
    movementIds.length > 0
      ? await admin
          .from("policy_installments")
          .select("id, movement_id, installment_number, due_date, paid_date, amount, paid_amount, status")
          .in("movement_id", movementIds)
          .order("installment_number", { ascending: true })
      : { data: [] };

  const outstandingInstallmentsByMovement = new Map<
    string,
    { id: string; installmentNumber: number; dueDate: string; paidDate: string | null; amount: number; paidAmount: number | null; status: string }[]
  >();
  for (const inst of rawMovementInstallments ?? []) {
    if (inst.status === "paid" || inst.status === "cancelled") continue;
    if (installmentRemaining(inst) <= 0) continue;
    const movementId = inst.movement_id as string;
    const list = outstandingInstallmentsByMovement.get(movementId) ?? [];
    list.push({
      id: inst.id,
      installmentNumber: inst.installment_number,
      dueDate: inst.due_date,
      paidDate: inst.paid_date,
      amount: inst.amount,
      paidAmount: inst.paid_amount,
      status: inst.status,
    });
    outstandingInstallmentsByMovement.set(movementId, list);
  }
  const uncollectedMovements = movements
    .map((m) => {
      const installments = outstandingInstallmentsByMovement.get(m.id) ?? [];
      const outstanding = installments.reduce((sum, i) => sum + installmentRemaining(i), 0);
      return { ...m, outstanding, installments };
    })
    .filter((m) => m.outstanding > 0);

  // A cancellation never gets a policy_installments row at all (it's a
  // refund owed to the client, not a receivable — see createManualMovement)
  // so it can never show up via uncollectedMovements above. It has to be
  // read straight off today's movements instead.
  const cancellationMovements = movements.filter((m) => m.kind === "cancellation");

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

  const selectedAgentName = agent_id ? (agents.find((a) => a.id === agent_id)?.label ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader
        title={`Κλείσιμο Ταμείου — ${formatDate(selectedDate)}${selectedAgentName ? ` — ${selectedAgentName}` : ""}`}
      />
      <div className="no-print flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ταμείο</h1>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/cash-register/calendar">Ημερολόγιο</Link>}
          />
        </div>
      </div>

      <form className="no-print flex flex-wrap items-end gap-3">
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
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή
        </Button>
      </form>

      <div className="flex flex-col gap-6">

        <div className="flex flex-col gap-6">
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
                      <TableHead>Χαρακτηριστικό</TableHead>
                      <TableHead>Κλάδος</TableHead>
                      <TableHead>Εταιρεία</TableHead>
                      <TableHead>Πελάτης</TableHead>
                      <TableHead>Ποσό</TableHead>
                      <TableHead>Μέθοδος</TableHead>
                      <TableHead>Απόδειξη</TableHead>
                      {isAdmin && <TableHead>Συνεργάτης</TableHead>}
                      <TableHead className="no-print" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.length ? (
                      collections.map((c) => {
                        const { number, client, riskLabel, carrier, line } = clientLabel(c.policy_installments);
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
                            <TableCell className="text-muted-foreground">{riskLabel}</TableCell>
                            <TableCell>{line}</TableCell>
                            <TableCell>{carrier}</TableCell>
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
                            <TableCell className="no-print whitespace-nowrap">
                              <Link
                                href={`/dashboard/cash-register/receipt/${c.id}`}
                                target="_blank"
                                className="text-sm underline-offset-2 hover:underline"
                              >
                                Εκτύπωση
                              </Link>
                              {isAdmin && (
                                <ReversePaymentButton paymentId={c.id} amountLabel={`${c.amount.toFixed(2)} €`} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 10} className="text-center text-muted-foreground">
                          Δεν υπάρχουν εισπράξεις για αυτή την ημέρα.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {uncollectedMovements.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">Ανείσπρακτες κινήσεις ημέρας</h2>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Είδος</TableHead>
                          <TableHead>Συμβόλαιο</TableHead>
                          <TableHead>Χαρακτηριστικό</TableHead>
                          <TableHead>Κλάδος</TableHead>
                          <TableHead>Εταιρεία</TableHead>
                          <TableHead>Πελάτης</TableHead>
                          <TableHead>Ποσό κίνησης</TableHead>
                          <TableHead>Ανείσπρακτο</TableHead>
                          {isAdmin && <TableHead>Συνεργάτης</TableHead>}
                          <TableHead className="no-print" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uncollectedMovements.map((m) => {
                          const policy = one(m.policies);
                          const client = one(policy?.clients ?? null);
                          const agent = one(policy?.agency_users ?? null);
                          const carrier = one(policy?.carriers ?? null);
                          const line = one(policy?.insurance_lines ?? null);
                          return (
                            <TableRow key={m.id}>
                              <TableCell>{POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}</TableCell>
                              <TableCell>
                                <Link href={`/dashboard/policies/${m.policy_id}`} className="hover:underline">
                                  {policy?.policy_number ?? "—"}
                                </Link>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                              <TableCell>{line?.name_el ?? "—"}</TableCell>
                              <TableCell>{carrier?.name ?? "—"}</TableCell>
                              <TableCell>{client?.display_name ?? "—"}</TableCell>
                              <TableCell>{m.premium_gross.toFixed(2)} €</TableCell>
                              <TableCell>
                                <Badge variant="warning">{m.outstanding.toFixed(2)} €</Badge>
                              </TableCell>
                              {isAdmin && <TableCell>{agent?.full_name ?? "—"}</TableCell>}
                              <TableCell className="no-print">
                                <CollectFromCashRegister
                                  policyId={m.policy_id}
                                  documentLabel={policy?.policy_number ?? "—"}
                                  kindLabel={POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}
                                  installments={m.installments}
                                  paymentMethods={paymentMethods}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {cancellationMovements.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">Ακυρώσεις συμβολαίων ημέρας (προς επιστροφή)</h2>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Συμβόλαιο</TableHead>
                          <TableHead>Χαρακτηριστικό</TableHead>
                          <TableHead>Κλάδος</TableHead>
                          <TableHead>Εταιρεία</TableHead>
                          <TableHead>Πελάτης</TableHead>
                          <TableHead>Ποσό επιστροφής</TableHead>
                          {isAdmin && <TableHead>Συνεργάτης</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cancellationMovements.map((m) => {
                          const policy = one(m.policies);
                          const client = one(policy?.clients ?? null);
                          const agent = one(policy?.agency_users ?? null);
                          const carrier = one(policy?.carriers ?? null);
                          const line = one(policy?.insurance_lines ?? null);
                          return (
                            <TableRow key={m.id}>
                              <TableCell>
                                <Link href={`/dashboard/policies/${m.policy_id}`} className="hover:underline">
                                  {policy?.policy_number ?? "—"}
                                </Link>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                              <TableCell>{line?.name_el ?? "—"}</TableCell>
                              <TableCell>{carrier?.name ?? "—"}</TableCell>
                              <TableCell>{client?.display_name ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{Math.abs(m.premium_gross).toFixed(2)} €</Badge>
                              </TableCell>
                              {isAdmin && <TableCell>{agent?.full_name ?? "—"}</TableCell>}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {reversals.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">Ακυρώσεις εισπράξεων ημέρας</h2>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ώρα</TableHead>
                          <TableHead>Συμβόλαιο</TableHead>
                          <TableHead>Χαρακτηριστικό</TableHead>
                          <TableHead>Κλάδος</TableHead>
                          <TableHead>Εταιρεία</TableHead>
                          <TableHead>Πελάτης</TableHead>
                          <TableHead>Ποσό</TableHead>
                          <TableHead>Αιτιολογία</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reversals.map((c) => {
                          const { number, client, riskLabel, carrier, line } = clientLabel(c.policy_installments);
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
                              <TableCell className="text-muted-foreground">{riskLabel}</TableCell>
                              <TableCell>{line}</TableCell>
                              <TableCell>{carrier}</TableCell>
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

              <div className="print-only mt-10 text-sm">
                <div className="flex items-end justify-between">
                  <div className="w-56 border-t pt-2 text-center text-muted-foreground">Ο ταμίας</div>
                  <div className="w-56 border-t pt-2 text-center text-muted-foreground">Ο διαχειριστής</div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
