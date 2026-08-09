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
import { commissionStatusVariant } from "@/lib/status-badge";
import { COMMISSION_TYPE_LABELS, COMMISSION_STATUS_LABELS } from "../../../commissions/commission-labels";

type Commission = {
  id: string;
  commission_type: string;
  commission_amount: number;
  status: string;
  period: string | null;
  policies: { id: string; policy_number: string } | null;
};

// Read-only roll-up across the client's policies — commissions belong to a
// policy, not a client, so editing still happens on the policy's own tab.
export function CommissionsTab({ commissions }: { commissions: Commission[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Προμήθειες</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Ποσό</TableHead>
              <TableHead>Περίοδος</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.length ? (
              commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.policies ? (
                      <Link href={`/dashboard/policies/${c.policies.id}`} className="hover:underline">
                        {c.policies.policy_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{COMMISSION_TYPE_LABELS[c.commission_type] ?? c.commission_type}</TableCell>
                  <TableCell>{c.commission_amount.toFixed(2)} €</TableCell>
                  <TableCell>{c.period ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={commissionStatusVariant(c.status)}>
                      {COMMISSION_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Δεν υπάρχουν προμήθειες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
