import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { policyStatusVariant } from "@/lib/status-badge";
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
import { updateClientNotes, createInteraction, toggleClientActive } from "../actions";
import { ReferrerField } from "../referrer-field";
import { EntitySelect } from "@/components/entity-select";
import { InteractionTypeSelect } from "../interaction-type-select";
import { INTERACTION_TYPE_LABELS } from "../interaction-labels";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { PrintButton } from "@/components/print-button";
import { createTicket } from "../../tickets/actions";
import { StatusSelect as TicketStatusSelect } from "../../tickets/status-select";
import type { TicketStatus } from "@/lib/database.types";

const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: "Φυσικό πρόσωπο",
  legal_entity: "Νομικό πρόσωπο",
};

const POLICY_STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
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
      "*, client_individuals(*), client_legal_entities(*), referred_by:referred_by_client_id(display_name)",
    )
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [{ data: policies }, { data: interactions }, documents, { data: installments }, { data: tickets }, { data: agents }] =
    await Promise.all([
      supabase
        .from("policies")
        .select("id, policy_number, status, end_date, premium_gross, insurance_lines(name_el)")
        .eq("client_id", id)
        .order("end_date", { ascending: false }),
      supabase
        .from("interactions")
        .select("id, interaction_type, subject, notes, interaction_date, follow_up_needed")
        .eq("client_id", id)
        .order("interaction_date", { ascending: false })
        .limit(20),
      getDocumentsFor("client", id),
      supabase
        .from("policy_installments")
        .select("policy_id, amount, status, policies!inner(client_id)")
        .eq("policies.client_id", id),
      supabase
        .from("client_tickets")
        .select("id, subject, description, status, priority, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);

  // "Billed"/"outstanding" are measured against each policy's actual
  // premium, not just the installment rows someone happened to create —
  // otherwise a policy with no (or partial) installments looks fully
  // collected even though most of the premium was never billed as a δόση.
  const paidByPolicy = new Map<string, number>();
  for (const i of installments ?? []) {
    if (i.status !== "paid") continue;
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + i.amount);
  }

  const billablePolicies = (policies ?? []).filter(
    (p) => p.status !== "draft" && p.status !== "cancelled",
  );
  const totalBilled = billablePolicies.reduce((sum, p) => sum + (p.premium_gross ?? 0), 0);
  const totalPaid = (installments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const outstanding = billablePolicies.reduce(
    (sum, p) => sum + Math.max((p.premium_gross ?? 0) - (paidByPolicy.get(p.id) ?? 0), 0),
    0,
  );

  const name = client.client_individuals
    ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
    : client.client_legal_entities?.company_name ?? "—";

  const updateAction = updateClientNotes.bind(null, id);
  const addInteractionAction = createInteraction.bind(null, id);
  const addTicketAction = createTicket.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {CLIENT_TYPE_LABELS[client.client_type]} · ΑΦΜ {client.afm ?? "—"}{" "}
            <Badge variant={client.is_active ? "success" : "outline"} className="ml-2">
              {client.is_active ? "Ενεργός" : "Ανενεργός"}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <form action={toggleClientActive.bind(null, id, !client.is_active)}>
            <Button type="submit" variant="outline">
              {client.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
            </Button>
          </form>
          <Button
            nativeButton={false}
            render={
              <Link href={`/dashboard/policies/new?client_id=${client.id}`}>Νέο συμβόλαιο</Link>
            }
          />
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Στοιχεία</TabsTrigger>
          <TabsTrigger value="interactions">Επικοινωνία</TabsTrigger>
          <TabsTrigger value="tickets">Αιτήματα</TabsTrigger>
          <TabsTrigger value="policies">Συμβόλαια</TabsTrigger>
          <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Στοιχεία επικοινωνίας</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="flex flex-col gap-4">
              <input type="hidden" name="client_type" value={client.client_type} />
              {client.client_type === "individual" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="father_name">Πατρώνυμο</Label>
                    <Input
                      id="father_name"
                      name="father_name"
                      defaultValue={client.client_individuals?.father_name ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="date_of_birth">Ημερομηνία γέννησης</Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      defaultValue={client.client_individuals?.date_of_birth ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="occupation">Επάγγελμα</Label>
                    <Input
                      id="occupation"
                      name="occupation"
                      defaultValue={client.client_individuals?.occupation ?? ""}
                    />
                  </div>
                </div>
              )}
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
                  <Label htmlFor="phone_landline">Σταθερό τηλέφωνο</Label>
                  <Input
                    id="phone_landline"
                    name="phone_landline"
                    defaultValue={client.phone_landline ?? ""}
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="referral_source">Πηγή σύστασης</Label>
                  <Input
                    id="referral_source"
                    name="referral_source"
                    placeholder="π.χ. Facebook, Google..."
                    defaultValue={client.referral_source ?? ""}
                  />
                </div>
                <ReferrerField
                  excludeId={client.id}
                  defaultReferrerId={client.referred_by_client_id ?? undefined}
                  defaultReferrerLabel={
                    (client.referred_by as unknown as { display_name: string | null } | null)
                      ?.display_name ?? undefined
                  }
                  defaultRelationship={client.referrer_relationship ?? undefined}
                />
                <EntitySelect
                  label="Συνεργάτης"
                  name="assigned_agent_id"
                  options={(agents ?? []).map((a) => ({ id: a.id, label: a.full_name }))}
                  defaultValue={client.assigned_agent_id ?? undefined}
                  placeholder="Επίλεξε συνεργάτη"
                />
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
            <CardTitle className="text-base">Οικονομική εικόνα</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Χρεωθέν σύνολο</span>
              <span className="text-right font-medium">{totalBilled.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Εισπραγμένο</span>
              <span className="text-right font-medium">{totalPaid.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Υπόλοιπο</span>
              <span
                className={`text-right font-medium ${outstanding > 0 ? "text-warning" : ""}`}
              >
                {outstanding.toFixed(2)} €
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="policies" className="pt-4">
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
                    <Badge variant={policyStatusVariant(policy.status)} className="mt-1 w-fit">
                      {POLICY_STATUS_LABELS[policy.status] ?? policy.status}
                    </Badge>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Δεν υπάρχουν συμβόλαια ακόμα.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactions" className="pt-4">
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
        </TabsContent>

        <TabsContent value="tickets" className="pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Αιτήματα</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ημ/νία</TableHead>
                <TableHead>Θέμα</TableHead>
                <TableHead>Περιγραφή</TableHead>
                <TableHead>Κατάσταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.length ? (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(ticket.created_at)}
                    </TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.description ?? "—"}</TableCell>
                    <TableCell>
                      <TicketStatusSelect
                        ticketId={ticket.id}
                        clientId={id}
                        status={ticket.status as TicketStatus}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Δεν υπάρχουν αιτήματα.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <form action={addTicketAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-subject">Θέμα</Label>
              <Input id="ticket-subject" name="subject" required className="w-56" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-description">Περιγραφή</Label>
              <Input id="ticket-description" name="description" className="w-72" />
            </div>
            <Button type="submit" variant="secondary">
              Καταχώρηση
            </Button>
          </form>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
      <DocumentsSection entityType="client" entityId={id} documents={documents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
