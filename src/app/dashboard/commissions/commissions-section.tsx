import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCommission } from "./actions";
import { StatusSelect } from "./status-select";
import { CommissionTypeSelect } from "./commission-type-select";
import { COMMISSION_TYPE_LABELS, COMMISSION_STATUS_LABELS } from "./commission-labels";
import type { CommissionStatus } from "@/lib/database.types";

type Commission = {
  id: string;
  commission_type: string;
  base_amount: number | null;
  commission_rate_percent: number | null;
  commission_amount: number;
  status: string;
  period: string | null;
};

export function CommissionsSection({
  policyId,
  carrierId,
  commissions,
  isAdmin,
  premiumNet,
}: {
  policyId: string;
  carrierId: string;
  commissions: Commission[];
  isAdmin: boolean;
  premiumNet?: number | null;
}) {
  const addAction = createCommission.bind(null, policyId, carrierId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Προμήθειες</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Τύπος</TableHead>
              <TableHead>Βάση</TableHead>
              <TableHead>Ποσοστό</TableHead>
              <TableHead>Ποσό</TableHead>
              <TableHead>Περίοδος</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.length ? (
              commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{COMMISSION_TYPE_LABELS[c.commission_type] ?? c.commission_type}</TableCell>
                  <TableCell>{c.base_amount != null ? `${c.base_amount} €` : "—"}</TableCell>
                  <TableCell>
                    {c.commission_rate_percent != null ? `${c.commission_rate_percent}%` : "—"}
                  </TableCell>
                  <TableCell>{c.commission_amount.toFixed(2)} €</TableCell>
                  <TableCell>{c.period ?? "—"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <StatusSelect
                        commissionId={c.id}
                        policyId={policyId}
                        status={c.status as CommissionStatus}
                      />
                    ) : (
                      COMMISSION_STATUS_LABELS[c.status] ?? c.status
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν προμήθειες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {isAdmin && (
          <form action={addAction} className="flex flex-wrap items-end gap-3">
            <CommissionTypeSelect />
            <div className="flex flex-col gap-2">
              <Label htmlFor="base_amount">Βάση (€)</Label>
              <Input
                id="base_amount"
                name="base_amount"
                type="number"
                step="0.01"
                defaultValue={premiumNet ?? undefined}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commission_rate_percent">Ποσοστό (%)</Label>
              <Input
                id="commission_rate_percent"
                name="commission_rate_percent"
                type="number"
                step="0.01"
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commission_amount">Ποσό (€)</Label>
              <Input
                id="commission_amount"
                name="commission_amount"
                type="number"
                step="0.01"
                required
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="period">Περίοδος</Label>
              <Input id="period" name="period" type="date" className="w-40" />
            </div>
            <Button type="submit" variant="secondary">
              Προσθήκη προμήθειας
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
