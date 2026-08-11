import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updatePolicyDetails } from "../actions";
import { buildPolicyMergeFields } from "@/lib/email";
import type { Commission } from "../../commissions/commissions-section";
import { DocumentsSection } from "../../documents/documents-section";
import { getDocumentsFor } from "../../documents/get-documents";
import { getCurrentAgencyUser } from "@/lib/dal";
import { resolveClientName } from "@/lib/client-name";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PolicyHeader } from "./_components/policy-header";
import { DetailsTab } from "./_components/details-tab";
import { InstallmentsTab } from "./_components/installments-tab";
import { ClaimsTab } from "./_components/claims-tab";
import { CommissionsTab } from "./_components/commissions-tab";
import { RenewalHistory } from "./_components/renewal-history";
import { ActivityFeed } from "@/components/activity-feed";
import type { PolicyStatus } from "@/lib/database.types";

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

  // Only what the header and the default-open Details tab need on first
  // paint. Installments/Claims are fetched lazily by their own tab
  // components on mount, since those queries used to run unconditionally
  // here even when the user never opened those tabs. Commissions/Documents
  // stay eager for now — they're shared components used elsewhere too, so
  // moving their data-fetching contract is lower-risk left for later.
  const [
    { data: vehicle },
    { data: property },
    { data: lifeHealth },
    documents,
    { data: commissions },
    { data: payees },
    agencyUser,
    { data: agents },
    { data: brokerOffices },
    { data: emailTemplates },
    { data: chainTerms },
    { data: activity },
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
    supabase
      .from("email_templates")
      .select("id, name, subject, body")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("name"),
    supabase
      .from("policies")
      .select("id, renewal_number, start_date, end_date, status")
      .eq("policy_group_id", policy.policy_group_id)
      .order("renewal_number", { ascending: true }),
    supabase
      .from("activity_log")
      .select("id, description, created_at, agency_users(full_name)")
      .eq("entity_type", "policy")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
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

  const updateDetailsAction = updatePolicyDetails.bind(null, id, !!vehicle, !!property, !!lifeHealth);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Συμβόλαια", href: "/dashboard/policies" }, { label: policy.policy_number }]} />
      <PolicyHeader
        policyId={id}
        policyNumber={policy.policy_number}
        status={policy.status as PolicyStatus}
        statusAutoManaged={policy.status_auto_managed}
        clientId={client?.id}
        clientName={clientName}
        lineName={line?.name_el}
        carrierName={(policy.carriers as unknown as { name: string } | null)?.name}
        riskLabel={policy.risk_label}
        renewalNumber={policy.renewal_number}
        clientEmail={client?.email ?? null}
        emailTemplates={emailTemplates ?? []}
        emailMergeFields={emailMergeFields}
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Στοιχεία</TabsTrigger>
          <TabsTrigger value="installments">Εισπράξεις</TabsTrigger>
          <TabsTrigger value="claims">Ζημιές</TabsTrigger>
          <TabsTrigger value="commissions">Προμήθειες</TabsTrigger>
          <TabsTrigger value="documents">Έγγραφα</TabsTrigger>
          <TabsTrigger value="activity">Δραστηριότητα</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex flex-col gap-4 pt-4">
          <DetailsTab
            policy={policy}
            vehicle={vehicle}
            property={property}
            lifeHealth={lifeHealth}
            agents={agents ?? []}
            brokerOffices={brokerOffices ?? []}
            updateDetailsAction={updateDetailsAction}
          />
          {(chainTerms?.length ?? 0) > 1 && (
            <RenewalHistory currentPolicyId={id} terms={chainTerms ?? []} />
          )}
        </TabsContent>

        <TabsContent value="installments" className="pt-4">
          <InstallmentsTab policyId={id} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="claims" className="pt-4">
          <ClaimsTab policyId={id} />
        </TabsContent>

        <TabsContent value="commissions" className="pt-4">
          <CommissionsTab
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

        <TabsContent value="activity" className="pt-4">
          <ActivityFeed entries={(activity ?? []) as never} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
