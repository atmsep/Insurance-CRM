import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusSelect } from "../status-select";
import { updateClaimDetails } from "../actions";
import type { ClaimStatus } from "@/lib/database.types";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { resolveClientName } from "@/lib/client-name";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claim } = await supabase
    .from("claims")
    .select(
      "*, policies(id, policy_number, clients(id, client_individuals(first_name,last_name), client_legal_entities(company_name)))",
    )
    .eq("id", id)
    .single();

  if (!claim) notFound();

  const documents = await getDocumentsFor("claim", id);

  const policy = claim.policies as unknown as {
    id: string;
    policy_number: string;
    clients: {
      id: string;
      client_individuals: { first_name: string; last_name: string } | null;
      client_legal_entities: { company_name: string } | null;
    } | null;
  } | null;

  const clientName = resolveClientName(policy?.clients);

  const updateAction = updateClaimDetails.bind(null, id, policy?.id ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ζημιά {claim.claim_number ?? ""}</h1>
          <p className="text-sm text-muted-foreground">
            Συμβόλαιο{" "}
            <Link href={`/dashboard/policies/${policy?.id}`} className="hover:underline">
              {policy?.policy_number}
            </Link>{" "}
            ·{" "}
            <Link href={`/dashboard/clients/${policy?.clients?.id}`} className="hover:underline">
              {clientName}
            </Link>
          </p>
        </div>
        <StatusSelect claimId={claim.id} policyId={policy?.id ?? ""} status={claim.status as ClaimStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Στοιχεία ζημιάς</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Αρ. φακέλου" value={claim.file_number ?? "—"} />
            <InfoRow label="Παθών" value={claim.injured_party_name ?? "—"} />
            <InfoRow label="Ημ. ζημιάς" value={formatDate(claim.date_of_loss)} />
            <InfoRow label="Ημ. αναφοράς" value={formatDate(claim.date_reported)} />
            <InfoRow
              label="Εκτιμώμενο ποσό"
              value={claim.claim_amount_estimated != null ? `${claim.claim_amount_estimated} €` : "—"}
            />
            <InfoRow
              label="Πληρωμένο ποσό"
              value={claim.claim_amount_paid != null ? `${claim.claim_amount_paid} €` : "—"}
            />
            <InfoRow
              label="Απομένον ποσό"
              value={
                claim.claim_amount_estimated != null
                  ? `${(claim.claim_amount_estimated - (claim.claim_amount_paid ?? 0)).toFixed(2)} €`
                  : "—"
              }
            />
            <InfoRow label="Ημ. πληρωμής" value={claim.payment_date ? formatDate(claim.payment_date) : "—"} />
            <InfoRow label="Ημ. διεκπεραίωσης" value={claim.closed_date ? formatDate(claim.closed_date) : "—"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Επεξεργασία στοιχείων</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="claim_number">Αριθμός ζημιάς</Label>
                  <Input id="claim_number" name="claim_number" defaultValue={claim.claim_number ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="file_number">Αρ. φακέλου</Label>
                  <Input id="file_number" name="file_number" defaultValue={claim.file_number ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="injured_party_name">Παθών</Label>
                  <Input
                    id="injured_party_name"
                    name="injured_party_name"
                    defaultValue={claim.injured_party_name ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="claim_amount_estimated">Εκτιμώμενο ποσό (€)</Label>
                  <Input
                    id="claim_amount_estimated"
                    name="claim_amount_estimated"
                    type="number"
                    step="0.01"
                    defaultValue={claim.claim_amount_estimated ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="claim_amount_paid">Πληρωμένο ποσό (€)</Label>
                  <Input
                    id="claim_amount_paid"
                    name="claim_amount_paid"
                    type="number"
                    step="0.01"
                    defaultValue={claim.claim_amount_paid ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment_date">Ημ. πληρωμής</Label>
                  <Input id="payment_date" name="payment_date" type="date" defaultValue={claim.payment_date ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="closed_date">Ημ. διεκπεραίωσης</Label>
                  <Input id="closed_date" name="closed_date" type="date" defaultValue={claim.closed_date ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjuster_name">Πραγματογνώμονας</Label>
                  <Input id="adjuster_name" name="adjuster_name" defaultValue={claim.adjuster_name ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adjuster_contact">Στοιχεία επικοινωνίας πραγματογνώμονα</Label>
                  <Input
                    id="adjuster_contact"
                    name="adjuster_contact"
                    defaultValue={claim.adjuster_contact ?? ""}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Περιγραφή</Label>
                <Textarea id="description" name="description" rows={4} defaultValue={claim.description ?? ""} />
              </div>
              <Button type="submit" className="w-fit">
                Αποθήκευση
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <DocumentsSection entityType="claim" entityId={id} documents={documents} />
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
