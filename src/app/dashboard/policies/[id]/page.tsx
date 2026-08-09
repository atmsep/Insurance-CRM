import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { claimStatusVariant, installmentStatusVariant } from "@/lib/status-badge";
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
import {
  createInstallment,
  collectInstallmentPayment,
  cancelInstallmentPayment,
  updatePolicyDetails,
} from "../actions";
import { CollectPaymentForm } from "../collect-payment-form";
import { CancelPaymentForm } from "../cancel-payment-form";
import { SendEmailButton } from "../send-email-button";
import { buildPolicyMergeFields } from "@/lib/email";
import { PaymentFrequencySelect } from "../payment-frequency-select";
import { PremiumFields } from "../premium-fields";
import type { PolicyStatus } from "@/lib/database.types";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { CommissionsSection, type Commission } from "../../commissions/commissions-section";
import { PrintButton } from "@/components/print-button";
import { getCurrentAgencyUser } from "@/lib/dal";
import { EntitySelect } from "@/components/entity-select";
import { resolveClientName } from "@/lib/client-name";

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
      "*, insurance_lines(*), carriers(name), clients(id, email, client_individuals(first_name,last_name), client_legal_entities(company_name))",
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
    email: string | null;
    client_individuals: { first_name: string; last_name: string } | null;
    client_legal_entities: { company_name: string } | null;
  } | null;

  const clientName = resolveClientName(client);

  const [
    { data: vehicle },
    { data: property },
    { data: lifeHealth },
    { data: installments },
    { data: claims },
    documents,
    { data: commissions },
    { data: payees },
    agencyUser,
    { data: agents },
    { data: brokerOffices },
    { data: paymentMethods },
    { data: emailTemplates },
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
      .select(
        "id, commission_type, direction, base_amount, commission_rate_percent, commission_amount, status, period, commission_payees(name)",
      )
      .eq("policy_id", id)
      .order("period", { ascending: false }),
    supabase.from("commission_payees").select("id, name").eq("is_active", true).order("name"),
    getCurrentAgencyUser(),
    supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("broker_offices")
      .select("id, name")
      .eq("is_active", true)
      .order("is_direct", { ascending: false })
      .order("name"),
    supabase.from("payment_methods").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("email_templates")
      .select("id, name, subject, body")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("name"),
  ]);

  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";

  const daysRemaining = Math.ceil(
    (new Date(policy.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );
  const emailMergeFields = buildPolicyMergeFields({
    clientName,
    policyNumber: policy.policy_number,
    lineName: line?.name_el ?? "—",
    carrierName: (policy.carriers as unknown as { name: string } | null)?.name ?? "—",
    endDate: policy.end_date,
    daysRemaining,
  });

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
          {policy.status === "active" && (
            <SendEmailButton
              policyId={id}
              clientEmail={client?.email ?? null}
              templates={emailTemplates ?? []}
              mergeFields={emailMergeFields}
            />
          )}
          <PrintButton />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/policies/new?renew_from=${policy.id}`}>Ανανέωση</Link>}
          />
          <StatusSelect policyId={policy.id} status={policy.status as PolicyStatus} />
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Στοιχεία</TabsTrigger>
          <TabsTrigger value="installments">Δόσεις</TabsTrigger>
          <TabsTrigger value="claims">Ζημιές</TabsTrigger>
          <TabsTrigger value="commissions">Προμήθειες</TabsTrigger>
          <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
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
              <PremiumFields defaultGross={policy.premium_gross} defaultNet={policy.premium_net} />
              <PaymentFrequencySelect defaultValue={policy.payment_frequency} />
              <EntitySelect
                label="Συνεργάτης"
                name="assigned_agent_id"
                options={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
                defaultValue={policy.assigned_agent_id ?? undefined}
                placeholder="Επίλεξε συνεργάτη"
              />
              <EntitySelect
                label="Συνεργαζόμενο γραφείο"
                name="broker_office_id"
                options={(brokerOffices ?? []).map((b) => ({ id: b.id, label: b.name }))}
                defaultValue={policy.broker_office_id ?? undefined}
                placeholder="— (προαιρετικό)"
              />
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
        </TabsContent>

        <TabsContent value="installments" className="pt-4">
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
                      <Badge variant={installmentStatusVariant(inst.status)}>
                        {PAYMENT_STATUS_LABELS[inst.status] ?? inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(inst.status === "pending" || inst.status === "overdue") && (
                        <CollectPaymentForm
                          installmentId={inst.id}
                          collectAction={collectInstallmentPayment.bind(null, id, inst.id)}
                          amount={inst.amount}
                          paymentMethods={paymentMethods ?? []}
                        />
                      )}
                      {isAdmin && (inst.status === "paid" || inst.status === "partially_paid") && (
                        <CancelPaymentForm
                          installmentId={inst.id}
                          cancelAction={cancelInstallmentPayment.bind(null, id, inst.id)}
                        />
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
        </TabsContent>

        <TabsContent value="claims" className="pt-4">
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
                      <Badge variant={claimStatusVariant(claim.status)}>
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
        </TabsContent>

        <TabsContent value="commissions" className="pt-4">
      <CommissionsSection
        policyId={id}
        carrierId={policy.carrier_id}
        insuranceLineId={policy.insurance_line_id}
        brokerOfficeId={policy.broker_office_id}
        commissions={(commissions ?? []) as unknown as Commission[]}
        isAdmin={isAdmin}
        premiumNet={policy.premium_net}
        payees={payees ?? []}
      />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
      <DocumentsSection entityType="policy" entityId={id} documents={documents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
