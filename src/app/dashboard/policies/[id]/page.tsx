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
import { createInstallment, markInstallmentPaid } from "../actions";
import type { PolicyStatus } from "@/lib/database.types";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";

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

  const [{ data: vehicle }, { data: property }, { data: lifeHealth }, { data: installments }, { data: claims }, documents] =
    await Promise.all([
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
    ]);

  const addInstallmentAction = createInstallment.bind(null, id);

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
        <StatusSelect policyId={policy.id} status={policy.status as PolicyStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Στοιχεία συμβολαίου</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Έναρξη" value={formatDate(policy.start_date)} />
            <InfoRow label="Λήξη" value={formatDate(policy.end_date)} />
            <InfoRow label="Μικτό ασφάλιστρο" value={`${policy.premium_gross.toFixed(2)} €`} />
            <InfoRow label="Συχνότητα" value={policy.payment_frequency} />
          </CardContent>
        </Card>

        {vehicle && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Στοιχεία οχήματος</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <InfoRow label="Πινακίδα" value={vehicle.plate_number ?? "—"} />
              <InfoRow label="Μάρκα / Μοντέλο" value={`${vehicle.make ?? ""} ${vehicle.model ?? ""}`} />
              <InfoRow label="Έτος" value={vehicle.manufacture_year?.toString() ?? "—"} />
            </CardContent>
          </Card>
        )}

        {property && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Στοιχεία ακινήτου</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <InfoRow label="Διεύθυνση" value={`${property.address_street ?? ""}, ${property.address_city ?? ""}`} />
              <InfoRow label="Τετραγωνικά" value={property.square_meters?.toString() ?? "—"} />
              <InfoRow label="Εμπορική αξία" value={property.commercial_value ? `${property.commercial_value} €` : "—"} />
            </CardContent>
          </Card>
        )}

        {lifeHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Στοιχεία κάλυψης</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <InfoRow label="Είδος κάλυψης" value={lifeHealth.coverage_type ?? "—"} />
              <InfoRow label="Ασφαλισμένο κεφάλαιο" value={lifeHealth.sum_insured ? `${lifeHealth.sum_insured} €` : "—"} />
            </CardContent>
          </Card>
        )}
      </div>

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

      <DocumentsSection entityType="policy" entityId={id} documents={documents} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
