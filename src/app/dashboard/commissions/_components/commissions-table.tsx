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
import { COMMISSION_TYPE_LABELS, COMMISSION_STATUS_LABELS } from "../commission-labels";
import { COMMISSION_DIRECTION_LABELS } from "../direction-labels";
import { commissionStatusVariant } from "@/lib/status-badge";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" }) : "—";
}

type CommissionRow = {
  id: string;
  commission_type: string;
  direction: string;
  commission_amount: number;
  status: string;
  period: string | null;
  policy_id: string | null;
  policy_number: string | null;
  agent_name: string | null;
  payee_name: string | null;
};

export async function CommissionsTable({
  status,
  direction,
}: {
  status?: string;
  direction?: string;
}) {
  const supabase = await createClient();

  // commissions_list (migration 0066) — the plain select+embed version
  // (joining policies/agency_users/commission_payees) hit a real statement
  // timeout under an authenticated session once commissions grew to
  // ~54,600 rows (the TRcth reimport). Same failure mode as
  // installments_worklist: security definer to bypass per-row RLS, backed
  // by a period-desc index so the executor can stop after p_limit rows
  // instead of sorting/checking the whole table.
  const [commissionsResult, totalsResult] = (await Promise.all([
    supabase.rpc("commissions_list", {
      p_status: status ?? null,
      p_direction: direction ?? null,
      p_limit: 100,
    }),
    supabase.rpc("commissions_filtered_total", {
      p_status: status ?? null,
      p_direction: direction ?? null,
    }),
  ])) as unknown as [
    { data: CommissionRow[] | null },
    { data: { total_amount: number; row_count: number }[] | null },
  ];

  const commissions = commissionsResult.data;
  const totals = totalsResult.data?.[0] ?? { total_amount: 0, row_count: 0 };
  const total = totals.total_amount;
  const isTruncated = totals.row_count > 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {isTruncated ? (
          <p className="text-sm text-muted-foreground">
            Εμφανίζονται 100 από {totals.row_count} — το σύνολο υπολογίζεται σε όλες.
          </p>
        ) : (
          <span />
        )}
        <p className="text-sm text-muted-foreground">
          Σύνολο: <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Κατεύθυνση</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Χειριστής</TableHead>
              <TableHead>Δικαιούχος</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Ποσό</TableHead>
              <TableHead>Περίοδος</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions?.length ? (
              commissions.map((c) => {
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {COMMISSION_DIRECTION_LABELS[c.direction] ?? c.direction}
                    </TableCell>
                    <TableCell>
                      {c.policy_id ? (
                        <Link href={`/dashboard/policies/${c.policy_id}`} className="hover:underline">
                          {c.policy_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{c.agent_name ?? "—"}</TableCell>
                    <TableCell>{c.payee_name ?? "—"}</TableCell>
                    <TableCell>
                      {COMMISSION_TYPE_LABELS[c.commission_type] ?? c.commission_type}
                    </TableCell>
                    <TableCell>{c.commission_amount.toFixed(2)} €</TableCell>
                    <TableCell>{formatDate(c.period)}</TableCell>
                    <TableCell>
                      <Badge variant={commissionStatusVariant(c.status)}>
                        {COMMISSION_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Δεν υπάρχουν προμήθειες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
