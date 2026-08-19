import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  updateClientNotes,
  createInteraction,
  updateIncomingCallNotes,
  updateClientProfile,
  setCallerIdOwner,
} from "../actions";
import { normalizeGreekPhone } from "@/lib/phone";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { createTicket } from "../../tickets/actions";
import { createTask } from "../../tasks/actions";
import { resolveClientName } from "@/lib/client-name";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClientHeader } from "./_components/client-header";
import { VisitTracker } from "./_components/visit-tracker";
import { DetailsTab } from "./_components/details-tab";
import { ProfileTab } from "./_components/profile-tab";
import { PoliciesTab, type Policy as ClientPolicy } from "./_components/policies-tab";
import { InteractionsTab } from "./_components/interactions-tab";
import { CallsTab } from "./_components/calls-tab";
import { TicketsTab } from "./_components/tickets-tab";
import { ReferralsTab, type ReferredClient } from "./_components/referrals-tab";
import { TasksTab } from "./_components/tasks-tab";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const agencyUser = await getCurrentAgencyUser();
  const isAdmin = agencyUser?.role === "owner" || agencyUser?.role === "admin";

  const { data: client } = await supabase
    .from("clients")
    .select(
      "*, client_individuals(*), client_legal_entities(*), referred_by:referred_by_client_id(display_name)",
    )
    .eq("id", id)
    .single();

  if (!client) notFound();

  const normalizedMobile = client.phone_mobile ? normalizeGreekPhone(client.phone_mobile) : null;
  const normalizedLandline = client.phone_landline ? normalizeGreekPhone(client.phone_landline) : null;
  const callerIdPhones = [...new Set([normalizedMobile, normalizedLandline].filter(Boolean))] as string[];

  const [
    { data: policies },
    { data: interactions },
    { data: calls },
    documents,
    { data: tickets },
    { data: agents },
    { data: tasks },
    { data: activity },
    { data: referrals },
    { data: ownReferralRewards },
    { data: defaultRule },
    { data: phoneOwners },
  ] = await Promise.all([
    supabase
      .from("policies")
      .select(
        "id, policy_number, status, start_date, end_date, premium_gross, renewal_number, risk_label, insurance_lines(name_el), carriers(name)",
      )
      .eq("client_id", id)
      .eq("is_current_term", true)
      .order("end_date", { ascending: false }),
    supabase
      .from("interactions")
      .select("id, interaction_type, subject, notes, interaction_date, follow_up_needed")
      .eq("client_id", id)
      .order("interaction_date", { ascending: false })
      .limit(20),
    supabase
      .from("incoming_calls")
      .select("id, phone_number, notes, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    getDocumentsFor("client", id),
    supabase
      .from("client_tickets")
      .select("id, subject, description, status, priority, created_at, assigned_to, resolution_notes")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("tasks")
      .select("id, title, due_date, status, priority")
      .eq("client_id", id)
      .order("due_date", { ascending: true }),
    supabase
      .from("activity_log")
      .select("id, description, created_at, agency_users(full_name)")
      .eq("entity_type", "client")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    // Every renewal term counts as its own reward-eligible policy, so this
    // deliberately does NOT filter on is_current_term the way the main
    // `policies` query above does.
    supabase
      .from("clients")
      .select(
        "id, client_code, client_type, is_active, created_at, " +
          "client_individuals(first_name,last_name), client_legal_entities(company_name), " +
          "policies(id, policy_number, status, premium_net, renewal_number, " +
          "referral_rewards(calc_type, rate_percent, fixed_amount, reward_amount, status, notes, source))",
      )
      .eq("referred_by_client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("referral_rewards").select("reward_amount, status").eq("referred_client_id", id),
    supabase
      .from("referral_reward_default_rule")
      .select("calc_type, rate_percent, fixed_amount")
      .eq("referrer_client_id", id)
      .maybeSingle(),
    callerIdPhones.length
      ? supabase.from("phone_owner_overrides").select("phone_number, client_id").in("phone_number", callerIdPhones)
      : Promise.resolve({ data: [] as { phone_number: string; client_id: string }[] }),
  ]);

  const name = resolveClientName(client);
  const referrerLabel =
    (client.referred_by as unknown as { display_name: string | null } | null)?.display_name ?? undefined;

  const activeOwnRewards = (ownReferralRewards ?? []).filter((r) => r.status !== "cancelled");
  const referralRewardTotal = activeOwnRewards.reduce((sum, r) => sum + r.reward_amount, 0);
  const referralRewardPolicyCount = activeOwnRewards.length;

  const updateAction = updateClientNotes.bind(null, id);
  const updateProfileAction = updateClientProfile.bind(null, id);
  const addInteractionAction = createInteraction.bind(null, id);
  const addTicketAction = createTicket.bind(null, id);
  const updateCallNotesAction = updateIncomingCallNotes.bind(null, id);
  const setCallerIdOwnerAction = setCallerIdOwner.bind(null, id);

  const isCallerIdOwner = (normalized: string | null) =>
    !!normalized && (phoneOwners ?? []).some((o) => o.phone_number === normalized && o.client_id === id);

  return (
    <div className="flex flex-col gap-6">
      <VisitTracker clientId={id} />
      <Breadcrumbs items={[{ label: "Πελάτες", href: "/dashboard/clients" }, { label: name }]} />
      <ClientHeader
        clientId={id}
        clientCode={client.client_code}
        name={name}
        clientType={client.client_type}
        afm={client.afm}
        isActive={client.is_active}
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Στοιχεία</TabsTrigger>
          <TabsTrigger value="profile">Προφίλ</TabsTrigger>
          <TabsTrigger value="interactions">Επικοινωνία</TabsTrigger>
          <TabsTrigger value="calls">Κλήσεις</TabsTrigger>
          <TabsTrigger value="tickets">Αιτήματα</TabsTrigger>
          <TabsTrigger value="referrals">Συστάσεις</TabsTrigger>
          <TabsTrigger value="tasks">Υπενθυμίσεις</TabsTrigger>
          <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
          <TabsTrigger value="activity">Δραστηριότητα</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="flex flex-col gap-6">
            <DetailsTab
              client={client}
              agents={agents ?? []}
              referrerLabel={referrerLabel}
              referralRewardTotal={referralRewardTotal}
              referralRewardPolicyCount={referralRewardPolicyCount}
              updateAction={updateAction}
              isMobileCallerIdOwner={isCallerIdOwner(normalizedMobile)}
              isLandlineCallerIdOwner={isCallerIdOwner(normalizedLandline)}
              setCallerIdOwnerAction={setCallerIdOwnerAction}
            />
            <PoliciesTab policies={(policies ?? []) as unknown as ClientPolicy[]} />
          </div>
        </TabsContent>

        <TabsContent value="profile" className="pt-4">
          <ProfileTab client={client} updateAction={updateProfileAction} />
        </TabsContent>

        <TabsContent value="interactions" className="pt-4">
          <InteractionsTab interactions={interactions ?? []} addInteractionAction={addInteractionAction} />
        </TabsContent>

        <TabsContent value="calls" className="pt-4">
          <CallsTab calls={calls ?? []} updateNotesAction={updateCallNotesAction} />
        </TabsContent>

        <TabsContent value="tickets" className="pt-4">
          <TicketsTab
            clientId={id}
            tickets={tickets ?? []}
            agents={agents ?? []}
            addTicketAction={addTicketAction}
          />
        </TabsContent>

        <TabsContent value="referrals" className="pt-4">
          <ReferralsTab
            referrerClientId={id}
            referrals={(referrals ?? []) as unknown as ReferredClient[]}
            isAdmin={isAdmin}
            defaultRule={defaultRule ?? null}
          />
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <TasksTab tasks={tasks ?? []} clientId={id} addTaskAction={createTask} />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <DocumentsSection entityType="client" entityId={id} documents={documents} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <ActivityFeed entries={(activity ?? []) as unknown as ActivityEntry[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
