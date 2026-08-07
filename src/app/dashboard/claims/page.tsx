import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  reported: "Αναφέρθηκε",
  under_review: "Υπό εξέταση",
  approved: "Εγκρίθηκε",
  rejected: "Απορρίφθηκε",
  paid: "Πληρώθηκε",
  closed: "Έκλεισε",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function ClaimsPage() {
  const supabase = await createClient();

  const { data: claims } = await supabase
    .from("claims")
    .select(
      "id, claim_number, status, date_of_loss, claim_amount_estimated, policies(policy_number, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
    )
    .order("date_of_loss", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ζημιές</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αριθμός ζημιάς</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Ημ. ζημιάς</TableHead>
              <TableHead>Εκτιμώμενο ποσό</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims?.length ? (
              claims.map((claim) => {
                const policy = claim.policies as unknown as {
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
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline">
                        {claim.claim_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{policy?.policy_number ?? "—"}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{formatDate(claim.date_of_loss)}</TableCell>
                    <TableCell>
                      {claim.claim_amount_estimated != null
                        ? `${claim.claim_amount_estimated.toFixed(2)} €`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{STATUS_LABELS[claim.status] ?? claim.status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν βρέθηκαν ζημιές.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
