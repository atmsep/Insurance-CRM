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
import { COMMISSION_TYPE_LABELS, COMMISSION_STATUS_LABELS } from "./commission-labels";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("el-GR") : "—";
}

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("commissions")
    .select(
      "id, commission_type, commission_amount, status, period, policies(id, policy_number), agency_users(full_name)",
    )
    .order("period", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data: commissions } = await query;

  const total = (commissions ?? []).reduce((sum, c) => sum + (c.commission_amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Προμήθειες</h1>
        <p className="text-sm text-muted-foreground">
          Σύνολο: <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Όλες οι καταστάσεις</option>
          {Object.entries(COMMISSION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Φίλτρο
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Συνεργάτης</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Ποσό</TableHead>
              <TableHead>Περίοδος</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions?.length ? (
              commissions.map((c) => {
                const policy = c.policies as unknown as { id: string; policy_number: string } | null;
                const agent = c.agency_users as unknown as { full_name: string } | null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {policy ? (
                        <Link href={`/dashboard/policies/${policy.id}`} className="hover:underline">
                          {policy.policy_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{agent?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {COMMISSION_TYPE_LABELS[c.commission_type] ?? c.commission_type}
                    </TableCell>
                    <TableCell>{c.commission_amount.toFixed(2)} €</TableCell>
                    <TableCell>{formatDate(c.period)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {COMMISSION_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
