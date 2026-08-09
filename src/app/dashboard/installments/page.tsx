import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { installmentStatusVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
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
  cancelled: "Ακυρώθηκε",
};

// This is an operational worklist (today's overdue/pending δόσεις), not a
// report — real pagination doesn't fit the "clear your queue" workflow, so
// it stays a single capped list. The cap is generous and the header makes
// truncation visible instead of silently dropping rows past it.
const LIST_CAP = 200;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function InstallmentsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: installments, count }, { data: paymentMethods }] = await Promise.all([
    supabase
      .from("policy_installments")
      .select(
        "id, policy_id, due_date, amount, status, policies(policy_number, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
        { count: "exact" },
      )
      .in("status", ["pending", "overdue", "partially_paid"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(LIST_CAP),
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const total = (installments ?? []).reduce((sum, i) => sum + i.amount, 0);
  const isTruncated = (count ?? 0) > LIST_CAP;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ληξιπρόθεσμες δόσεις</h1>
          {isTruncated && (
            <p className="text-sm text-muted-foreground">
              Εμφανίζονται {LIST_CAP} από {count} — εξόφλησε τις παλαιότερες για να δεις τις υπόλοιπες.
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Σύνολο: <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
        </p>
      </div>

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
            {installments?.length ? (
              installments.map((inst) => {
                const policy = inst.policies as unknown as {
                  policy_number: string;
                  clients: {
                    client_individuals: { first_name: string; last_name: string } | null;
                    client_legal_entities: { company_name: string } | null;
                  } | null;
                } | null;
                const name = resolveClientName(policy?.clients);

                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <Link href={`/dashboard/policies/${inst.policy_id}`} className="hover:underline">
                        {policy?.policy_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{formatDate(inst.due_date)}</TableCell>
                    <TableCell>{inst.amount.toFixed(2)} €</TableCell>
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
                        paymentMethods={paymentMethods ?? []}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν ληξιπρόθεσμες δόσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
