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

  const [{ data: policies }, { data: installments }, { data: claims }, { data: commissions }] =
    await Promise.all([
      supabase.from("policies").select("status, premium_gross, insurance_lines(name_el)"),
      supabase.from("policy_installments").select("amount, status"),
      supabase.from("claims").select("status, claim_amount_estimated, claim_amount_paid"),
      supabase.from("commissions").select("status, commission_amount"),
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

  const totalBilled = (installments ?? []).reduce((sum, i) => sum + i.amount, 0);
  const totalCollected = (installments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const outstanding = totalBilled - totalCollected;

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
