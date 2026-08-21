import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyUser } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { installmentRemaining, isBillablePolicyStatus } from "../policies/balance";
import { formatDate } from "@/lib/date";
import { CollectFromCashRegister } from "../cash-register/_components/collect-from-cash-register";
import { PrintButton } from "@/components/print-button";
import { ListPageHeader } from "@/components/list-page-header";
import { ReportPrintHeader } from "../reports/_components/report-print-header";

// Τα ανείσπρακτα ήταν καρτέλα μέσα στο Ταμείο. Βγήκαν σε δική τους σελίδα
// γιατί δεν είναι δουλειά της ημέρας: το Ταμείο κλείνει μια συγκεκριμένη
// μέρα, ενώ αυτό είναι μόνιμο υπόλοιπο ανεξάρτητο από ημερομηνία.

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type OutstandingInstallmentRow = {
  id: string;
  policy_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    status: string;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
};

export default async function UncollectedPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const sp = await searchParams;

  // Ο απλός συνεργάτης βλέπει ΜΟΝΟ τα δικά του — δεν παρακάμπτεται με
  // παράμετρο στη διεύθυνση. Ίδιο σχήμα με το Ταμείο.
  const scopeAgentId = isAdmin ? sp.agent || null : agencyUser.id;
  const admin = createAdminClient();

  // Το PostgREST κόβει σιωπηλά στις 1000 γραμμές και αυτή η λίστα μόνο
  // μεγαλώνει, οπότε διαβάζεται σε κομμάτια.
  const CHUNK = 1000;
  const MAX_ROWS = 10000;
  const rows: unknown[] = [];
  for (let from = 0; from < MAX_ROWS; from += CHUNK) {
    let q = admin
      .from("policy_installments")
      .select(
        "id, policy_id, installment_number, due_date, amount, paid_amount, status, " +
          "policies!inner(policy_number, risk_label, status, assigned_agent_id, clients(display_name), " +
          "agency_users!policies_assigned_agent_id_fkey(full_name), carriers(name), insurance_lines(name_el))",
      )
      .in("status", ["pending", "overdue", "partially_paid"])
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (scopeAgentId) q = q.eq("policies.assigned_agent_id", scopeAgentId);
    const { data } = await q;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < CHUNK) break;
  }

  const [{ data: agents }, { data: paymentMethods }] = await Promise.all([
    isAdmin
      ? admin.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] }),
    admin.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  // Εκκρεμής δόση ακυρωμένου ή πρόχειρου συμβολαίου δεν είναι πια οφειλή —
  // ίδιος κανόνας με το getOutstandingByPolicy.
  const outstanding = (rows as OutstandingInstallmentRow[]).filter((inst) => {
    const policy = one(inst.policies);
    return policy ? isBillablePolicyStatus(policy.status) && installmentRemaining(inst) > 0 : false;
  });
  const total = outstanding.reduce((sum, inst) => sum + installmentRemaining(inst), 0);

  return (
    <div className="flex flex-col gap-6">
      <ReportPrintHeader title="Ανείσπρακτα" />
      <div className="no-print">
        <ListPageHeader
          title="Ανείσπρακτα"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/reports/receivables">Μαζική είσπραξη</Link>}
              />
              <PrintButton />
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 no-print">
        {isAdmin && (
          <form className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="agent" className="text-xs text-muted-foreground">Συνεργάτης</label>
              <select
                id="agent"
                name="agent"
                defaultValue={sp.agent ?? ""}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Όλοι οι συνεργάτες</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" size="sm">Εφαρμογή</Button>
          </form>
        )}
        <div className="rounded-md border bg-muted px-4 py-2">
          <p className="text-xs text-muted-foreground">Σύνολο ανείσπρακτων</p>
          <p className="text-lg font-semibold tabular-nums">{total.toFixed(2)} €</p>
        </div>
        <div className="rounded-md border px-4 py-2">
          <p className="text-xs text-muted-foreground">Δόσεις</p>
          <p className="text-lg font-semibold tabular-nums">{outstanding.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ. λήξης</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Χαρακτηριστικό</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Ποσό δόσης</TableHead>
              <TableHead>Ανείσπρακτο</TableHead>
              {isAdmin && <TableHead>Συνεργάτης</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {outstanding.length ? (
              outstanding.map((inst) => {
                const policy = one(inst.policies);
                const client = one(policy?.clients ?? null);
                const agent = one(policy?.agency_users ?? null);
                const carrier = one(policy?.carriers ?? null);
                const line = one(policy?.insurance_lines ?? null);
                const remaining = installmentRemaining(inst);
                return (
                  <TableRow key={inst.id}>
                    <TableCell>{formatDate(inst.due_date)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${inst.policy_id}`} className="hover:underline">
                        {policy?.policy_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                    <TableCell>{line?.name_el ?? "—"}</TableCell>
                    <TableCell>{carrier?.name ?? "—"}</TableCell>
                    <TableCell>{client?.display_name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{inst.amount.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Badge variant="warning">{remaining.toFixed(2)} €</Badge>
                    </TableCell>
                    {isAdmin && <TableCell>{agent?.full_name ?? "—"}</TableCell>}
                    <TableCell className="no-print">
                      <CollectFromCashRegister
                        policyId={inst.policy_id}
                        documentLabel={policy?.policy_number ?? "—"}
                        kindLabel={null}
                        installments={[
                          {
                            id: inst.id,
                            installmentNumber: inst.installment_number,
                            dueDate: inst.due_date,
                            paidDate: null,
                            amount: inst.amount,
                            paidAmount: inst.paid_amount,
                            status: inst.status,
                          },
                        ]}
                        paymentMethods={paymentMethods ?? []}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground">
                  Δεν υπάρχουν ανείσπρακτες δόσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
