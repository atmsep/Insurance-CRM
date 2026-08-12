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
import { COMMISSION_DIRECTION_LABELS } from "./direction-labels";
import { commissionStatusVariant } from "@/lib/status-badge";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" }) : "—";
}

const DIRECTION_TABS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Όλες" },
  { value: "incoming", label: "Εισερχόμενες" },
  { value: "outgoing", label: "Εξερχόμενες" },
];

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; direction?: string }>;
}) {
  const { status, direction } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("commissions")
    .select(
      "id, commission_type, direction, commission_amount, status, period, policies(id, policy_number), agency_users(full_name), commission_payees(name)",
    )
    .order("period", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (direction) query = query.eq("direction", direction);

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

      <div className="flex flex-wrap gap-2">
        {DIRECTION_TABS.map((tab) => {
          const isActive = (direction ?? undefined) === tab.value;
          const href = tab.value
            ? `/dashboard/commissions?direction=${tab.value}`
            : "/dashboard/commissions";
          return (
            <Button
              key={tab.label}
              size="sm"
              variant={isActive ? "default" : "outline"}
              nativeButton={false}
              render={<Link href={href}>{tab.label}</Link>}
            />
          );
        })}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        {direction && <input type="hidden" name="direction" value={direction} />}
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
                const policy = c.policies as unknown as { id: string; policy_number: string } | null;
                const agent = c.agency_users as unknown as { full_name: string } | null;
                const payee = c.commission_payees as unknown as { name: string } | null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {COMMISSION_DIRECTION_LABELS[c.direction] ?? c.direction}
                    </TableCell>
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
                    <TableCell>{payee?.name ?? "—"}</TableCell>
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
