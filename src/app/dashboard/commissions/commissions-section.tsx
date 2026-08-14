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
import { createCommission } from "./actions";
import { StatusSelect } from "./status-select";
import { AddCommissionForm } from "./add-commission-form";
import { COMMISSION_TYPE_LABELS, COMMISSION_STATUS_LABELS } from "./commission-labels";
import { COMMISSION_DIRECTION_LABELS } from "./direction-labels";
import { commissionStatusVariant } from "@/lib/status-badge";
import type { CommissionStatus } from "@/lib/database.types";

export type Commission = {
  id: string;
  commission_type: string;
  direction: string;
  base_amount: number | null;
  commission_rate_percent: number | null;
  commission_amount: number;
  status: string;
  period: string | null;
  commission_payees?: { name: string } | { name: string }[] | null;
};

function payeeName(payees: Commission["commission_payees"]) {
  if (!payees) return null;
  return Array.isArray(payees) ? payees[0]?.name ?? null : payees.name;
}

export function CommissionsSection({
  policyId,
  carrierId,
  insuranceLineId,
  brokerOfficeId,
  commissions,
  isAdmin,
  premiumNet,
  payees,
  onCommissionAdded,
}: {
  policyId: string;
  carrierId: string;
  insuranceLineId: string;
  brokerOfficeId: string | null;
  commissions: Commission[];
  isAdmin: boolean;
  premiumNet?: number | null;
  payees: { id: string; name: string }[];
  // Server components (the full policy page) rely on revalidatePath to
  // refresh `commissions` on next render; client-fetched consumers (the
  // Κινήσεις "Απόδειξη" sheet) have no such trigger and need an explicit
  // nudge to refetch after a successful add.
  onCommissionAdded?: () => void;
}) {
  const addAction = async (formData: FormData) => {
    await createCommission(policyId, carrierId, formData);
    onCommissionAdded?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Προμήθειες</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Κατεύθυνση</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Δικαιούχος</TableHead>
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
                  <TableCell>{COMMISSION_DIRECTION_LABELS[c.direction] ?? c.direction}</TableCell>
                  <TableCell>{COMMISSION_TYPE_LABELS[c.commission_type] ?? c.commission_type}</TableCell>
                  <TableCell>{payeeName(c.commission_payees) ?? "—"}</TableCell>
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
                      <Badge variant={commissionStatusVariant(c.status)}>
                        {COMMISSION_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Δεν υπάρχουν προμήθειες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {isAdmin && (
          <AddCommissionForm
            addAction={addAction}
            payees={payees}
            premiumNet={premiumNet}
            carrierId={carrierId}
            insuranceLineId={insuranceLineId}
            brokerOfficeId={brokerOfficeId}
          />
        )}
      </CardContent>
    </Card>
  );
}
