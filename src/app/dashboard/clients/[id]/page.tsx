import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateClientNotes, createInteraction } from "../actions";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { createTicket } from "../../tickets/actions";
import { resolveClientName } from "@/lib/client-name";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClientHeader } from "./_components/client-header";
import { DetailsTab } from "./_components/details-tab";
import { PoliciesTab, type Policy as ClientPolicy } from "./_components/policies-tab";
import { InteractionsTab } from "./_components/interactions-tab";
import { TicketsTab } from "./_components/tickets-tab";
import { CommissionsTab, type Commission as ClientCommission } from "./_components/commissions-tab";
import { ReferralsTab, type ReferredClient } from "./_components/referrals-tab";
import { TasksTab } from "./_components/tasks-tab";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";
import { installmentApplied, installmentTip } from "../../policies/balance";

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
    documents,
    { data: installments },
    { data: tickets },
    { data: agents },
    { data: commissions },
    { data: tasks },
    { data: activity },
    { data: referrals },
    { data: ownReferralRewards },
    { data: defaultRule },
  ] = await Promise.all([
    supabase
      .from("policies")
      .select("id, policy_number, status, end_date, premium_gross, renewal_number, insurance_lines(name_el)")
      .eq("client_id", id)
      .eq("is_current_term", true)
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
      .select("policy_id, amount, status, paid_amount, policies!inner(client_id)")
      .eq("policies.client_id", id),
    supabase
      .from("client_tickets")
      .select("id, subject, description, status, priority, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("commissions")
      .select("id, commission_type, commission_amount, status, period, policies!inner(id, policy_number, client_id)")
      .eq("policies.client_id", id)
      .order("created_at", { ascending: false }),
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
  const currentInstallments = (installments ?? []).filter((i) => currentPolicyIds.has(i.policy_id));

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
  const addInteractionAction = createInteraction.bind(null, id);
  const addTicketAction = createTicket.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
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
          <TabsTrigger value="policies">Συμβόλαια</TabsTrigger>
          <TabsTrigger value="interactions">Επικοινωνία</TabsTrigger>
          <TabsTrigger value="tickets">Αιτήματα</TabsTrigger>
          <TabsTrigger value="commissions">Προμήθειες</TabsTrigger>
          <TabsTrigger value="referrals">Συστάσεις</TabsTrigger>
          <TabsTrigger value="tasks">Υπενθυμίσεις</TabsTrigger>
          <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
          <TabsTrigger value="activity">Δραστηριότητα</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
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
        </TabsContent>

        <TabsContent value="policies" className="pt-4">
          <PoliciesTab policies={(policies ?? []) as unknown as ClientPolicy[]} />
        </TabsContent>

        <TabsContent value="interactions" className="pt-4">
          <InteractionsTab interactions={interactions ?? []} addInteractionAction={addInteractionAction} />
        </TabsContent>

        <TabsContent value="tickets" className="pt-4">
          <TicketsTab clientId={id} tickets={tickets ?? []} addTicketAction={addTicketAction} />
        </TabsContent>

        <TabsContent value="commissions" className="pt-4">
          <CommissionsTab commissions={(commissions ?? []) as unknown as ClientCommission[]} />
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
          <TasksTab tasks={tasks ?? []} />
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
