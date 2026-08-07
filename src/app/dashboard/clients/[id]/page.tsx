import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateClientNotes, createInteraction } from "../actions";
import { InteractionTypeSelect } from "../interaction-type-select";
import { INTERACTION_TYPE_LABELS } from "../interaction-labels";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";

const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: "Φυσικό πρόσωπο",
  legal_entity: "Νομικό πρόσωπο",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "*, client_individuals(*), client_legal_entities(*)",
    )
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [{ data: policies }, { data: interactions }, documents] = await Promise.all([
    supabase
      .from("policies")
      .select("id, policy_number, status, end_date, insurance_lines(name_el)")
      .eq("client_id", id)
      .order("end_date", { ascending: false }),
    supabase
      .from("interactions")
      .select("id, interaction_type, subject, notes, interaction_date, follow_up_needed")
      .eq("client_id", id)
      .order("interaction_date", { ascending: false })
      .limit(20),
    getDocumentsFor("client", id),
  ]);

  const name = client.client_individuals
    ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
    : client.client_legal_entities?.company_name ?? "—";

  const updateAction = updateClientNotes.bind(null, id);
  const addInteractionAction = createInteraction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {CLIENT_TYPE_LABELS[client.client_type]} · ΑΦΜ {client.afm ?? "—"}
          </p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href={`/dashboard/policies/new?client_id=${client.id}`}>Νέο συμβόλαιο</Link>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Στοιχεία επικοινωνίας</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone_mobile">Κινητό τηλέφωνο</Label>
                  <Input
                    id="phone_mobile"
                    name="phone_mobile"
                    defaultValue={client.phone_mobile ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="address_city">Πόλη</Label>
                  <Input
                    id="address_city"
                    name="address_city"
                    defaultValue={client.address_city ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" name="iban" defaultValue={client.iban ?? ""} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Σημειώσεις</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} />
              </div>
              <Button type="submit" className="w-fit">
                Αποθήκευση
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Συμβόλαια</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {policies?.length ? (
              policies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/dashboard/policies/${policy.id}`}
                  className="flex flex-col rounded-md border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{policy.policy_number}</span>
                  <span className="text-muted-foreground">
                    {(policy.insurance_lines as unknown as { name_el: string } | null)?.name_el}
                  </span>
                  <Badge variant="outline" className="mt-1 w-fit">
                    {policy.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν συμβόλαια ακόμα.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Επικοινωνία</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ημ/νία</TableHead>
                <TableHead>Τύπος</TableHead>
                <TableHead>Θέμα</TableHead>
                <TableHead>Σημειώσεις</TableHead>
                <TableHead>Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interactions?.length ? (
                interactions.map((interaction) => (
                  <TableRow key={interaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(interaction.interaction_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {INTERACTION_TYPE_LABELS[interaction.interaction_type] ??
                          interaction.interaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{interaction.subject ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{interaction.notes ?? "—"}</TableCell>
                    <TableCell>{interaction.follow_up_needed ? "Ναι" : "—"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Δεν υπάρχει ιστορικό επικοινωνίας.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={addInteractionAction} className="flex flex-wrap items-end gap-3">
            <InteractionTypeSelect />
            <div className="flex flex-col gap-2">
              <Label htmlFor="subject">Θέμα</Label>
              <Input id="subject" name="subject" className="w-56" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes-interaction">Σημειώσεις</Label>
              <Input id="notes-interaction" name="notes" className="w-72" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="follow_up_needed" className="size-4" />
              Χρειάζεται follow-up
            </label>
            <Button type="submit" variant="secondary">
              Καταχώρηση
            </Button>
          </form>
        </CardContent>
      </Card>

      <DocumentsSection entityType="client" entityId={id} documents={documents} />
    </div>
  );
}
