import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  reported: "Αναφέρθηκε",
  under_review: "Υπό εξέταση",
  approved: "Εγκρίθηκε",
  rejected: "Απορρίφθηκε",
  paid: "Πληρώθηκε",
  closed: "Έκλεισε",
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  invoiced: "Τιμολογήθηκε",
  paid: "Πληρώθηκε",
  cancelled: "Ακυρώθηκε",
};

function groupSum<T>(rows: T[], keyFn: (row: T) => string, valueFn: (row: T) => number) {
  const map = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const entry = map.get(key) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += valueFn(row);
    map.set(key, entry);
  }
  return map;
}

export default async function ReportsPage() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [
    { data: policies },
    { data: installments },
    { data: claims },
    { data: commissions },
    { data: carrierInstallments },
    { data: carrierCommissions },
  ] = await Promise.all([
    supabase.from("policies").select("id, status, premium_gross, insurance_lines(name_el)"),
    supabase.from("policy_installments").select("policy_id, amount, status"),
    supabase.from("claims").select("status, claim_amount_estimated, claim_amount_paid"),
    supabase.from("commissions").select("status, commission_amount"),
    supabase
      .from("policy_installments")
      .select("amount, status, policies!inner(carrier_id, carriers(name))"),
    supabase.from("commissions").select("carrier_id, commission_amount, status, carriers(name)"),
  ]);

  const policiesByStatus = groupSum(
    policies ?? [],
    (p) => p.status,
    () => 1,
  );
  const activePremium = (policies ?? [])
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + (p.premium_gross ?? 0), 0);

  const lineBreakdown = groupSum(
    policies ?? [],
    (p) => (p.insurance_lines as unknown as { name_el: string } | null)?.name_el ?? "—",
    (p) => p.premium_gross ?? 0,
  );

  // "Billed"/"outstanding" are measured against each policy's actual premium,
  // not just the installment rows someone happened to create — otherwise a
  // policy with no (or partial) installments looks fully collected.
  const paidByPolicy = new Map<string, number>();
  for (const i of installments ?? []) {
    if (i.status !== "paid") continue;
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + i.amount);
  }

  const billablePolicies = (policies ?? []).filter(
    (p) => p.status !== "draft" && p.status !== "cancelled",
  );
  const totalBilled = billablePolicies.reduce((sum, p) => sum + (p.premium_gross ?? 0), 0);
  const totalCollected = (installments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const outstanding = billablePolicies.reduce(
    (sum, p) => sum + Math.max((p.premium_gross ?? 0) - (paidByPolicy.get(p.id) ?? 0), 0),
    0,
  );

  const claimsByStatus = groupSum(
    claims ?? [],
    (c) => c.status,
    (c) => c.claim_amount_paid ?? c.claim_amount_estimated ?? 0,
  );

  const commissionsByStatus = groupSum(
    commissions ?? [],
    (c) => c.status,
    (c) => c.commission_amount,
  );
  const totalCommissions = (commissions ?? []).reduce((sum, c) => sum + c.commission_amount, 0);

  type CarrierAgg = {
    name: string;
    collected: number;
    commissionTotal: number;
    commissionPending: number;
  };
  const carrierMap = new Map<string, CarrierAgg>();

  for (const i of carrierInstallments ?? []) {
    if (i.status !== "paid") continue;
    const p = i.policies as unknown as { carrier_id: string; carriers: { name: string } | null } | null;
    if (!p) continue;
    const entry = carrierMap.get(p.carrier_id) ?? {
      name: p.carriers?.name ?? "—",
      collected: 0,
      commissionTotal: 0,
      commissionPending: 0,
    };
    entry.collected += i.amount;
    carrierMap.set(p.carrier_id, entry);
  }

  for (const c of carrierCommissions ?? []) {
    const carrierName = (c.carriers as unknown as { name: string } | null)?.name ?? "—";
    const entry = carrierMap.get(c.carrier_id) ?? {
      name: carrierName,
      collected: 0,
      commissionTotal: 0,
      commissionPending: 0,
    };
    entry.commissionTotal += c.commission_amount;
    if (c.status === "pending" || c.status === "invoiced") {
      entry.commissionPending += c.commission_amount;
    }
    carrierMap.set(c.carrier_id, entry);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Αναφορές</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ενεργό ασφάλιστρο" value={`${activePremium.toFixed(2)} €`} />
        <StatCard label="Χρεωθέν σύνολο δόσεων" value={`${totalBilled.toFixed(2)} €`} />
        <StatCard label="Εισπραγμένο" value={`${totalCollected.toFixed(2)} €`} />
        <StatCard
          label="Ανείσπρακτο υπόλοιπο"
          value={`${outstanding.toFixed(2)} €`}
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Συμβόλαια ανά κατάσταση</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...policiesByStatus.entries()].map(([status, { count }]) => (
                  <TableRow key={status}>
                    <TableCell>{POLICY_STATUS_LABELS[status] ?? status}</TableCell>
                    <TableCell>{count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ασφάλιστρο ανά κλάδο</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κλάδος</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Σύνολο ασφαλίστρου</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...lineBreakdown.entries()].map(([line, { count, total }]) => (
                  <TableRow key={line}>
                    <TableCell>{line}</TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>{total.toFixed(2)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ζημιές ανά κατάσταση</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Ποσό</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimsByStatus.size ? (
                  [...claimsByStatus.entries()].map(([status, { count, total }]) => (
                    <TableRow key={status}>
                      <TableCell>{CLAIM_STATUS_LABELS[status] ?? status}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{total.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Δεν υπάρχουν ζημιές.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Προμήθειες ανά κατάσταση — σύνολο {totalCommissions.toFixed(2)} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead>Πλήθος</TableHead>
                  <TableHead>Ποσό</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionsByStatus.size ? (
                  [...commissionsByStatus.entries()].map(([status, { count, total }]) => (
                    <TableRow key={status}>
                      <TableCell>{COMMISSION_STATUS_LABELS[status] ?? status}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>{total.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Δεν υπάρχουν προμήθειες.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Καρτέλα ανά ασφαλιστική εταιρεία</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              &quot;Οφειλή προς εταιρεία&quot; = εισπραγμένο ασφάλιστρο μείον το σύνολο των
              προμηθειών μας — ενδεικτικός υπολογισμός, όχι επίσημη λογιστική καρτέλα.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Εταιρεία</TableHead>
                  <TableHead>Εισπραγμένο ασφάλιστρο</TableHead>
                  <TableHead>Προμήθειά μας</TableHead>
                  <TableHead>Εκκρεμής προμήθεια (μας οφείλει)</TableHead>
                  <TableHead>Οφειλή προς εταιρεία (εκτίμηση)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carrierMap.size ? (
                  [...carrierMap.entries()].map(([carrierId, agg]) => (
                    <TableRow key={carrierId}>
                      <TableCell>{agg.name}</TableCell>
                      <TableCell>{agg.collected.toFixed(2)} €</TableCell>
                      <TableCell>{agg.commissionTotal.toFixed(2)} €</TableCell>
                      <TableCell>{agg.commissionPending.toFixed(2)} €</TableCell>
                      <TableCell>{(agg.collected - agg.commissionTotal).toFixed(2)} €</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Δεν υπάρχουν δεδομένα ακόμα.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  const toneClass = tone === "warning" ? "text-amber-600 dark:text-amber-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
