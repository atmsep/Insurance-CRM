import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import { markInstallmentPaid } from "../policies/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
  cancelled: "Ακυρώθηκε",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function InstallmentsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: installments } = await supabase
    .from("policy_installments")
    .select(
      "id, policy_id, due_date, amount, status, policies(policy_number, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
    )
    .in("status", ["pending", "overdue", "partially_paid"])
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(100);

  const total = (installments ?? []).reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ληξιπρόθεσμες δόσεις</h1>
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
                const client = policy?.clients;
                const name = client?.client_individuals
                  ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
                  : client?.client_legal_entities?.company_name ?? "—";

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
                      <Badge variant="destructive">{STATUS_LABELS[inst.status] ?? inst.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <form action={markInstallmentPaid.bind(null, inst.policy_id, inst.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Πληρώθηκε
                        </Button>
                      </form>
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
