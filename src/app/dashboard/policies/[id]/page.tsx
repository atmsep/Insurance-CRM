import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusSelect } from "../status-select";
import { createInstallment, markInstallmentPaid, updatePolicyDetails } from "../actions";
import { PaymentFrequencySelect } from "../payment-frequency-select";
import type { PolicyStatus } from "@/lib/database.types";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { CommissionsSection } from "../../commissions/commissions-section";
import { getCurrentAgencyUser } from "@/lib/dal";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  overdue: "Ληξιπρόθεσμη",
  partially_paid: "Μερική πληρωμή",
  cancelled: "Ακυρώθηκε",
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  reported: "Αναφέρθηκε",
  under_review: "Υπό εξέταση",
  approved: "Εγκρίθηκε",
  rejected: "Απορρίφθηκε",
  paid: "Πληρώθηκε",
  closed: "Έκλεισε",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: policy } = await supabase
    .from("policies")
    .select(
      "*, insurance_lines(*), carriers(name), clients(id, client_individuals(first_name,last_name), client_legal_entities(company_name))",
    )
    .eq("id", id)
    .single();

  if (!policy) notFound();

  const line = policy.insurance_lines as unknown as {
    name_el: string;
    requires_vehicle_details: boolean;
    requires_property_details: boolean;
    requires_life_health_details: boolean;
  } | null;

  const client = policy.clients as unknown as {
    id: string;
    client_individuals: { first_name: string; last_name: string } | null;
    client_legal_entities: { company_name: string } | null;
  } | null;

  const clientName = client?.client_individuals
    ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
    : client?.client_legal_entities?.company_name ?? "—";

  const [
    { data: vehicle },
    { data: property },
    { data: lifeHealth },
    { data: installments },
    { data: claims },
    documents,
    { data: commissions },
    agencyUser,
  ] = await Promise.all([
    line?.requires_vehicle_details
      ? supabase.from("policy_vehicle_details").select("*").eq("policy_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    line?.requires_property_details
      ? supabase.from("policy_property_details").select("*").eq("policy_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    line?.requires_life_health_details
      ? supabase.from("policy_life_health_details").select("*").eq("policy_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("policy_installments")
      .select("*")
      .eq("policy_id", id)
      .order("installment_number", { ascending: true }),
    supabase
      .from("claims")
      .select("id, claim_number, status, date_of_loss, claim_amount_estimated")
      .eq("policy_id", id)
      .order("date_of_loss", { ascending: false }),
    getDocumentsFor("policy", id),
    supabase
      .from("commissions")
      .select("id, commission_type, base_amount, commission_rate_percent, commission_amount, status, period")
      .eq("policy_id", id)
      .order("period", { ascending: false }),
    getCurrentAgencyUser(),
  ]);

  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";

  const addInstallmentAction = createInstallment.bind(null, id);
  const updateDetailsAction = updatePolicyDetails.bind(
    null,
    id,
    !!vehicle,
    !!property,
    !!lifeHealth,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{policy.policy_number}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/dashboard/clients/${client?.id}`} className="hover:underline">
              {clientName}
            </Link>{" "}
            · {line?.name_el} · {(policy.carriers as unknown as { name: string } | null)?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/policies/new?renew_from=${policy.id}`}>Ανανέωση</Link>}
          />
          <StatusSelect policyId={policy.id} status={policy.status as PolicyStatus} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Στοιχεία συμβολαίου</CardTitle>
        </CardHeader>
        <CardContent>
          {policy.previous_policy_id && (
            <p className="mb-4 text-sm text-muted-foreground">
              Προηγούμενη περίοδος:{" "}
              <Link
                href={`/dashboard/policies/${policy.previous_policy_id}`}
                className="font-medium hover:underline"
              >
                Προβολή
              </Link>
            </p>
          )}
          <form action={updateDetailsAction} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Έναρξη</Label>
                <Input id="start_date" name="start_date" type="date" defaultValue={policy.start_date} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end_date">Λήξη</Label>
                <Input id="end_date" name="end_date" type="date" defaultValue={policy.end_date} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="premium_gross">Μικτό ασφάλιστρο (€)</Label>
                <Input
                  id="premium_gross"
                  name="premium_gross"
                  type="number"
                  step="0.01"
                  defaultValue={policy.premium_gross}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="premium_net">Καθαρό ασφάλιστρο (€)</Label>
                <Input
                  id="premium_net"
                  name="premium_net"
                  type="number"
                  step="0.01"
                  defaultValue={policy.premium_net ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="taxes_fees">Τέλη/Φόροι (€)</Label>
                <Input
                  id="taxes_fees"
                  name="taxes_fees"
                  type="number"
                  step="0.01"
                  defaultValue={policy.taxes_fees ?? ""}
                />
              </div>
              <PaymentFrequencySelect defaultValue={policy.payment_frequency} />
            </div>

            {vehicle && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία οχήματος</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="plate_number">Πινακίδα</Label>
                    <Input id="plate_number" name="plate_number" defaultValue={vehicle.plate_number ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="manufacture_year">Έτος κατασκευής</Label>
                    <Input
                      id="manufacture_year"
                      name="manufacture_year"
                      type="number"
                      defaultValue={vehicle.manufacture_year ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="make">Μάρκα</Label>
                    <Input id="make" name="make" defaultValue={vehicle.make ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="model">Μοντέλο</Label>
                    <Input id="model" name="model" defaultValue={vehicle.model ?? ""} />
                  </div>
                </div>
              </fieldset>
            )}

            {property && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία ακινήτου</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address_street">Οδός</Label>
                    <Input id="address_street" name="address_street" defaultValue={property.address_street ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="address_city">Πόλη</Label>
                    <Input id="address_city" name="address_city" defaultValue={property.address_city ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="square_meters">Τετραγωνικά μέτρα</Label>
                    <Input
                      id="square_meters"
                      name="square_meters"
                      type="number"
                      defaultValue={property.square_meters ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="commercial_value">Εμπορική αξία (€)</Label>
                    <Input
                      id="commercial_value"
                      name="commercial_value"
                      type="number"
                      defaultValue={property.commercial_value ?? ""}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {lifeHealth && (
              <fieldset className="flex flex-col gap-4 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Στοιχεία κάλυψης</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="coverage_type">Είδος κάλυψης</Label>
                    <Input id="coverage_type" name="coverage_type" defaultValue={lifeHealth.coverage_type ?? ""} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sum_insured">Ασφαλισμένο κεφάλαιο (€)</Label>
                    <Input
                      id="sum_insured"
                      name="sum_insured"
                      type="number"
                      defaultValue={lifeHealth.sum_insured ?? ""}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            <Button type="submit" className="w-fit">
              Αποθήκευση
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Δόσεις</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Ημ. λήξης</TableHead>
                <TableHead>Ποσό</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments?.length ? (
                installments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>{inst.installment_number}</TableCell>
                    <TableCell>{formatDate(inst.due_date)}</TableCell>
                    <TableCell>{inst.amount.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Badge variant={inst.status === "paid" ? "default" : "outline"}>
                        {PAYMENT_STATUS_LABELS[inst.status] ?? inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inst.status !== "paid" && (
                        <form action={markInstallmentPaid.bind(null, id, inst.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            Πληρώθηκε
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Δεν υπάρχουν δόσεις.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={addInstallmentAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Ημ. λήξης δόσης</Label>
              <Input id="due_date" name="due_date" type="date" required className="w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Ποσό (€)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required className="w-32" />
            </div>
            <Button type="submit" variant="secondary">
              Προσθήκη δόσης
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ζημιές</CardTitle>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/dashboard/claims/new?policy_id=${id}`}>Νέα ζημιά</Link>}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Αριθμός</TableHead>
                <TableHead>Ημ. ζημιάς</TableHead>
                <TableHead>Εκτιμώμενο ποσό</TableHead>
                <TableHead>Κατάσταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims?.length ? (
                claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline">
                        {claim.claim_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(claim.date_of_loss)}</TableCell>
                    <TableCell>
                      {claim.claim_amount_estimated != null
                        ? `${claim.claim_amount_estimated} €`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CLAIM_STATUS_LABELS[claim.status] ?? claim.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Δεν υπάρχουν ζημιές.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CommissionsSection
        policyId={id}
        carrierId={policy.carrier_id}
        commissions={commissions ?? []}
        isAdmin={isAdmin}
        premiumNet={policy.premium_net}
      />

      <DocumentsSection entityType="policy" entityId={id} documents={documents} />
    </div>
  );
}
