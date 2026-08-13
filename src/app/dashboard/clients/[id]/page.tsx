import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  updateClientNotes,
  createInteraction,
  updateIncomingCallNotes,
  updateClientProfile,
} from "../actions";
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
import { OutstandingTab } from "./_components/outstanding-tab";
import { LedgerTab } from "./_components/ledger-tab";
import { TasksTab } from "./_components/tasks-tab";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";
import { installmentApplied, installmentTip } from "../../policies/balance";

type ClientInstallmentRow = {
  id: string;
  policy_id: string;
  policy_number: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_amount: number | null;
  installment_payments: { amount: number; paid_date: string; paid_at: string; is_reversed: boolean }[];
};

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

  const [
    { data: policies },
    { data: interactions },
    { data: calls },
    documents,
    { data: installments },
    { data: tickets },
    { data: agents },
    { data: tasks },
    { data: activity },
    { data: referrals },
    { data: ownReferralRewards },
    { data: defaultRule },
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
    // Widened beyond what the totalBilled/totalPaid/outstanding math below
    // needs (amount/paid_amount/status/policy_id) so the same call also
    // feeds the Λογιστική Καρτέλα tab (installment_payments + policy_number)
    // — one round-trip for both consumers, not two. This used to be a plain
    // PostgREST embedded query (policies!inner + .eq("policies.client_id",…))
    // but that shape hit a real statement timeout under an authenticated
    // session — PostgREST's translation of the embedded filter defeats the
    // planner's use of policies_client_idx (confirmed: the equivalent
    // hand-written join runs in ~1ms). client_installments_ledger
    // (migration 0070) is that same join as a security-definer RPC.
    supabase.rpc("client_installments_ledger", { p_client_id: id }) as unknown as Promise<{
      data: ClientInstallmentRow[] | null;
    }>,
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
  ]);

  const installmentRows = installments ?? [];

  // "Billed"/"outstanding" are measured against each policy's actual
  // premium, not just the installment rows someone happened to create —
  // otherwise a policy with no (or partial) installments looks fully
  // collected even though most of the premium was never billed as a δόση.
  //
  // The installments query itself isn't scoped to is_current_term (an old
  // renewed-away term can still have real payment history), so it's scoped
  // here instead: only installments belonging to a currently-listed policy
  // count toward these totals, keeping them consistent with totalBilled
  // (which is already derived from the is_current_term-filtered `policies`).
  const currentPolicyIds = new Set((policies ?? []).map((p) => p.id));
  const currentInstallments = installmentRows.filter((i) => currentPolicyIds.has(i.policy_id));

  const paidByPolicy = new Map<string, number>();
  for (const i of currentInstallments) {
    if (i.status !== "paid" && i.status !== "partially_paid") continue;
    paidByPolicy.set(i.policy_id, (paidByPolicy.get(i.policy_id) ?? 0) + installmentApplied(i));
  }

  const billablePolicies = (policies ?? []).filter(
    (p) => p.status !== "draft" && p.status !== "cancelled",
  );
  const totalBilled = billablePolicies.reduce((sum, p) => sum + (p.premium_gross ?? 0), 0);
  const totalPaid = currentInstallments
    .filter((i) => i.status === "paid" || i.status === "partially_paid")
    .reduce((sum, i) => sum + installmentApplied(i), 0);
  const totalTips = currentInstallments.reduce((sum, i) => sum + installmentTip(i), 0);
  const outstanding = billablePolicies.reduce(
    (sum, p) => sum + Math.max((p.premium_gross ?? 0) - (paidByPolicy.get(p.id) ?? 0), 0),
    0,
  );

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
          <TabsTrigger value="outstanding">Ανείσπρακτα</TabsTrigger>
          <TabsTrigger value="ledger">Λογιστική Καρτέλα</TabsTrigger>
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
              totalBilled={totalBilled}
              totalPaid={totalPaid}
              totalTips={totalTips}
              outstanding={outstanding}
              referralRewardTotal={referralRewardTotal}
              referralRewardPolicyCount={referralRewardPolicyCount}
              updateAction={updateAction}
            />
            <PoliciesTab policies={(policies ?? []) as unknown as ClientPolicy[]} />
          </div>
        </TabsContent>

        <TabsContent value="profile" className="pt-4">
          <ProfileTab client={client} updateAction={updateProfileAction} />
        </TabsContent>

        <TabsContent value="outstanding" className="pt-4">
          <OutstandingTab clientId={id} />
        </TabsContent>

        <TabsContent value="ledger" className="pt-4">
          <LedgerTab clientId={id} installments={installmentRows} />
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
