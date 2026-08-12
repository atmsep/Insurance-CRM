import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { installmentStatusVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
import { installmentRemaining } from "../policies/balance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collectInstallmentPayment } from "../policies/actions";
import { CollectPaymentForm } from "../policies/collect-payment-form";

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
};

type ClientEmbed = {
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
} | null;

type Row = {
  id: string;
  policy_id: string;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
  policies: {
    policy_number: string;
    assigned_agent_id: string | null;
    clients: ClientEmbed;
  } | null;
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
              const name = resolveClientName(inst.policies?.clients ?? null);
              const remaining = installmentRemaining(inst);

              return (
                <TableRow key={inst.id}>
                  <TableCell>
                    <Link href={`/dashboard/policies/${inst.policy_id}`} className="hover:underline">
                      {inst.policies?.policy_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{name}</TableCell>
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

export default async function InstallmentsPage() {
  const supabase = await createClient();
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";

  const [{ data: installments, count }, { data: paymentMethods }, { data: agents }] =
    await Promise.all([
      supabase
        .from("policy_installments")
        .select(
          "id, policy_id, due_date, amount, status, paid_amount, " +
            "policies!inner(policy_number, status, assigned_agent_id, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
          { count: "exact" },
        )
        .neq("status", "paid")
        .not("policies.status", "in", "(draft,cancelled)")
        .order("due_date", { ascending: true })
        .limit(LIST_CAP),
      supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
      isAdmin
        ? supabase.from("agency_users").select("id, full_name").order("full_name")
        : Promise.resolve({ data: [] }),
    ]);

  const rows = (installments ?? []) as unknown as Row[];
  const total = rows.reduce((sum, i) => sum + installmentRemaining(i), 0);
  const isTruncated = (count ?? 0) > LIST_CAP;

  const agentNameById = new Map((agents ?? []).map((a) => [a.id, a.full_name]));

  type Group = { key: string; label: string; rows: Row[] };
  let groups: Group[] | null = null;
  if (isAdmin) {
    const byAgent = new Map<string, Group>();
    for (const row of rows) {
      const agentId = row.policies?.assigned_agent_id ?? "unassigned";
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
          <h1 className="text-2xl font-semibold">Ανείσπρακτα</h1>
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
                  <RowsTable rows={group.rows} paymentMethods={paymentMethods ?? []} />
                </CardContent>
              </Card>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν ανείσπρακτα.</p>
        )
      ) : (
        <RowsTable rows={rows} paymentMethods={paymentMethods ?? []} />
      )}
    </div>
  );
}
