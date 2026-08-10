import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { policyStatusVariant } from "@/lib/status-badge";

const POLICY_STATUS_LABELS: Record<string, string> = {
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

type Policy = {
  id: string;
  policy_number: string;
  status: string;
  end_date: string;
  premium_gross: number;
  renewal_number: number;
  insurance_lines: { name_el: string } | null;
};

export function PoliciesTab({ policies }: { policies: Policy[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Συμβόλαια</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αριθμός</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Λήξη</TableHead>
              <TableHead>Ασφάλιστρο</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length ? (
              policies.map((policy) => (
                <TableRow key={policy.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/dashboard/policies/${policy.id}`} className="hover:underline">
                      {policy.policy_number}
                    </Link>
                    {policy.renewal_number > 1 && (
                      <Badge variant="outline" className="ml-2">
                        Ανανέωση #{policy.renewal_number}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{policy.insurance_lines?.name_el ?? "—"}</TableCell>
                  <TableCell>{formatDate(policy.end_date)}</TableCell>
                  <TableCell>{policy.premium_gross.toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant={policyStatusVariant(policy.status)}>
                      {POLICY_STATUS_LABELS[policy.status] ?? policy.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Δεν υπάρχουν συμβόλαια ακόμα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
