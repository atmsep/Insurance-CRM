import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { installmentStatusVariant } from "@/lib/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collectInstallmentPayment } from "../../policies/actions";
import { CollectPaymentForm } from "../../policies/collect-payment-form";
import { getAgentsListCached, getActivePaymentMethodsCached } from "@/lib/cached-queries/lookups";

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

type Row = {
  id: string;
  policy_id: string;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
  policy_number: string;
  assigned_agent_id: string | null;
  client_name: string;
};

// This is an operational worklist (every issued policy still owed money —
// full or partial), not a report — real pagination doesn't fit the "clear
// your queue" workflow, so it stays a single capped list. The cap is
// generous and the header makes truncation visible instead of silently
// dropping rows past it.
const LIST_CAP = 300;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

function installmentRemaining(inst: { amount: number; paid_amount: number | null }) {
  return Math.max(inst.amount - (inst.paid_amount ?? 0), 0);
}

function RowsTable({
  rows,
  paymentMethods,
}: {
  rows: Row[];
  paymentMethods: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Συμβόλαιο</TableHead>
            <TableHead>Πελάτης</TableHead>
            <TableHead>Ημ. λήξης</TableHead>
            <TableHead>Ποσό</TableHead>
            <TableHead>Κατάσταση</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((inst) => {
              const remaining = installmentRemaining(inst);

              return (
                <TableRow key={inst.id}>
                  <TableCell>
                    <Link href={`/dashboard/policies/${inst.policy_id}`} className="hover:underline">
                      {inst.policy_number}
                    </Link>
                  </TableCell>
                  <TableCell>{inst.client_name}</TableCell>
                  <TableCell>{formatDate(inst.due_date)}</TableCell>
                  <TableCell>
                    <div>{remaining.toFixed(2)} €</div>
                    {inst.status === "partially_paid" && (
                      <div className="text-xs text-muted-foreground">
                        Δόθηκαν {(inst.paid_amount ?? 0).toFixed(2)} € από {inst.amount.toFixed(2)} €
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={installmentStatusVariant(inst.status)}>
                      {STATUS_LABELS[inst.status] ?? inst.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CollectPaymentForm
                      installmentId={inst.id}
                      collectAction={collectInstallmentPayment.bind(null, inst.policy_id, inst.id)}
                      amount={inst.amount}
                      alreadyPaid={inst.paid_amount ?? 0}
                      paymentMethods={paymentMethods}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Δεν υπάρχουν ανείσπρακτα.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export async function InstallmentsWorklist() {
  const supabase = await createClient();
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";

  // The list+count queries used to join policy_installments -> policies ->
  // clients directly; per-row RLS on both joined tables compounded enough
  // to hit a real statement timeout once policy_installments grew past a
  // few thousand rows (confirmed live). installments_worklist/_count
  // (migration 0065) do the same join and the equivalent agent/admin
  // scoping in one explicit WHERE condition instead of per-row RLS.
  const [worklistResult, countResult, paymentMethods, agents, totalsResult] = await Promise.all([
    supabase.rpc("installments_worklist", { p_limit: LIST_CAP }) as unknown as Promise<{
      data: Row[] | null;
    }>,
    supabase.rpc("installments_worklist_count") as unknown as Promise<{ data: number | null }>,
    // Agency-wide config lookups, not agent-scoped — cached (see
    // src/lib/cached-queries/lookups.ts) instead of re-querying every load.
    getActivePaymentMethodsCached(),
    isAdmin ? getAgentsListCached() : Promise.resolve([]),
    supabase.rpc("installments_outstanding_total") as unknown as Promise<{ data: number | null }>,
  ]);

  const rows = worklistResult.data ?? [];
  const count = countResult.data ?? 0;
  // The true total (not rows.reduce, which only covers the .limit(LIST_CAP)
  // page) — installmentRemaining's per-row math is mirrored in SQL by
  // installments_outstanding_total (migration 0062).
  const total = totalsResult.data ?? 0;
  const isTruncated = count > LIST_CAP;

  const agentNameById = new Map(agents.map((a) => [a.id, a.full_name]));

  type Group = { key: string; label: string; rows: Row[] };
  let groups: Group[] | null = null;
  if (isAdmin) {
    const byAgent = new Map<string, Group>();
    for (const row of rows) {
      const agentId = row.assigned_agent_id ?? "unassigned";
      const label = agentId === "unassigned" ? "Χωρίς ανάθεση" : (agentNameById.get(agentId) ?? "—");
      if (!byAgent.has(agentId)) byAgent.set(agentId, { key: agentId, label, rows: [] });
      byAgent.get(agentId)!.rows.push(row);
    }
    groups = [...byAgent.values()].sort((a, b) => a.label.localeCompare(b.label, "el"));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          {isTruncated && (
            <p className="text-sm text-muted-foreground">
              Εμφανίζονται {LIST_CAP} από {count} — εξόφλησε τα παλαιότερα για να δεις τα υπόλοιπα.
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Σύνολο: <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
        </p>
      </div>

      {groups ? (
        groups.length ? (
          groups.map((group) => {
            const groupTotal = group.rows.reduce((sum, i) => sum + installmentRemaining(i), 0);
            return (
              <Card key={group.key}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <span className="text-sm text-muted-foreground">{groupTotal.toFixed(2)} €</span>
                </CardHeader>
                <CardContent>
                  <RowsTable rows={group.rows} paymentMethods={paymentMethods} />
                </CardContent>
              </Card>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν ανείσπρακτα.</p>
        )
      ) : (
        <RowsTable rows={rows} paymentMethods={paymentMethods} />
      )}
    </div>
  );
}
