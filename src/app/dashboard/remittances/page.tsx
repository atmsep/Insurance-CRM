import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import { POLICY_MOVEMENT_KIND_LABELS } from "../policies/movement-labels";
import { togglePremiumRemittance, toggleOutgoingCommissionRemittance } from "../policies/movements-actions";
import { getOutgoingCommissionsByMovement } from "../reports/production/commissions";

type SingleOrMany<T> = T | T[] | null;
function one<T>(v: SingleOrMany<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type RemittanceMovementRow = {
  id: string;
  kind: string;
  document_number: string | null;
  issue_date: string;
  premium_gross: number;
  policy_id: string;
  policies: SingleOrMany<{
    policy_number: string;
    risk_label: string | null;
    clients: SingleOrMany<{ display_name: string | null }>;
    agency_users: SingleOrMany<{ full_name: string }>;
    carriers: SingleOrMany<{ name: string }>;
    insurance_lines: SingleOrMany<{ name_el: string }>;
  }>;
};

const MOVEMENT_SELECT =
  "id, kind, document_number, issue_date, premium_gross, policy_id, " +
  "policies!inner(policy_number, risk_label, clients(display_name), " +
  "agency_users!policies_assigned_agent_id_fkey(full_name), carriers(name), insurance_lines(name_el))";

// Rows on this page are always the currently-unremitted ones (that's the
// whole point of a worklist), so the toggle here only ever goes one
// direction — these wrappers just fix currentlyRemitted=false and discard
// the {error} return, since a plain <form action> needs a void-returning
// server action.
async function remitPremium(movementId: string) {
  "use server";
  await togglePremiumRemittance(movementId, false);
}

async function remitCommission(movementId: string) {
  "use server";
  await toggleOutgoingCommissionRemittance(movementId, false);
}

// Worklist for the two per-movement remittance toggles that already exist
// in the Απόδειξη dialog (togglePremiumRemittance/
// toggleOutgoingCommissionRemittance) — this page just aggregates every
// movement still missing one of them, instead of requiring an admin to
// open each policy's Κινήσεις tab one at a time to notice. Admin client for
// the same reason as the production report: policy_movements_select RLS
// has the identical per-row EXISTS-subquery shape that already caused two
// real statement timeouts elsewhere in this schema.
export default async function RemittancesPage() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [{ data: rawPremiumPending }, { data: rawCommissionCandidates }] = await Promise.all([
    admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT)
      .is("premium_remitted_at", null)
      .order("issue_date", { ascending: true }),
    admin
      .from("policy_movements")
      .select(MOVEMENT_SELECT)
      .is("outgoing_commission_remitted_at", null)
      .order("issue_date", { ascending: true }),
  ]);

  const premiumPending = (rawPremiumPending ?? []) as unknown as RemittanceMovementRow[];
  const commissionCandidates = (rawCommissionCandidates ?? []) as unknown as RemittanceMovementRow[];

  // Only movements that actually carry a nonzero outgoing commission are
  // worth listing — matches the production report's own precedent for
  // resolving "Προμήθεια Συνεργάτη" (first-installment path for every kind
  // but cancellation, which attaches via policy_movement_id instead).
  const commissionByMovement = await getOutgoingCommissionsByMovement(
    admin,
    commissionCandidates.map((m) => ({ id: m.id, isReal: true })),
  );
  const commissionPending = commissionCandidates
    .map((m) => ({ ...m, commission: commissionByMovement.get(m.id) ?? 0 }))
    .filter((m) => m.commission !== 0);

  function renderTable<T extends RemittanceMovementRow>(
    rows: T[],
    amountLabel: string,
    getAmount: (m: T) => number,
    action: (movementId: string) => Promise<void>,
  ) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Έκδοση</TableHead>
              <TableHead>Είδος</TableHead>
              <TableHead>Συμβόλαιο</TableHead>
              <TableHead>Χαρακτηριστικό</TableHead>
              <TableHead>Κλάδος</TableHead>
              <TableHead>Εταιρεία</TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>{amountLabel}</TableHead>
              <TableHead>Συνεργάτης</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((m) => {
                const policy = one(m.policies);
                const client = one(policy?.clients ?? null);
                const agent = one(policy?.agency_users ?? null);
                const carrier = one(policy?.carriers ?? null);
                const line = one(policy?.insurance_lines ?? null);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.issue_date)}</TableCell>
                    <TableCell>{POLICY_MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/policies/${m.policy_id}`} className="hover:underline">
                        {policy?.policy_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{policy?.risk_label ?? "—"}</TableCell>
                    <TableCell>{line?.name_el ?? "—"}</TableCell>
                    <TableCell>{carrier?.name ?? "—"}</TableCell>
                    <TableCell>{client?.display_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="warning">{getAmount(m).toFixed(2)} €</Badge>
                    </TableCell>
                    <TableCell>{agent?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <form action={action.bind(null, m.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Απόδοση
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Δεν υπάρχουν εκκρεμείς αποδόσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Αποδόσεις</h1>

      <Tabs defaultValue="premium">
        <TabsList>
          <TabsTrigger value="premium">Ασφάλιστρα ({premiumPending.length})</TabsTrigger>
          <TabsTrigger value="commission">Προμήθειες ({commissionPending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="premium" className="pt-4">
          {renderTable(premiumPending, "Μικτά", (m) => m.premium_gross, remitPremium)}
        </TabsContent>

        <TabsContent value="commission" className="pt-4">
          {renderTable(commissionPending, "Προμήθεια", (m) => m.commission, remitCommission)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
