import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { installmentRemaining } from "../policies/balance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { CarriersTab } from "./carriers-tab";
import { TeamTab } from "./team-tab";
import { PayeesTab } from "./payees-tab";
import { BrokerOfficesTab } from "./broker-offices-tab";
import {
  CommissionAgreementsTab,
  type BrokerOfficeWithAgreements,
  type PayeeWithAgreements,
} from "./commission-agreements-tab";
import { PaymentMethodsTab } from "./payment-methods-tab";
import { AutomationsTab } from "./automations-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { ErrorsTab } from "./errors-tab";
import { BanksTab } from "./banks-tab";
import { ClientCategoriesTab } from "./client-categories-tab";
import { LeadSourcesTab } from "./lead-sources-tab";
import { SpecialtiesTab } from "./specialties-tab";
import { VehicleBrandsTab } from "./vehicle-brands-tab";
import { VehicleUsagesTab } from "./vehicle-usages-tab";
import { CurrenciesTab } from "./currencies-tab";
import { CollectionCentersTab } from "./collection-centers-tab";
import { OccupationsTab } from "./occupations-tab";
import { ClaimCategoriesTab } from "./claim-categories-tab";
import { AreasTab } from "./areas-tab";
import { InsuranceLinesTab } from "./insurance-lines-tab";

export default async function SettingsPage() {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const supabase = await createClient();

  const [
    { data: carriers },
    { data: users },
    { data: outstandingRows },
    { data: payees },
    { data: brokerOffices },
    { data: insuranceLines },
    { data: brokerOfficesWithAgreements },
    { data: payeesWithAgreements },
    { data: paymentMethods },
    { data: appSettings },
    { data: emailTemplates },
    { data: recentErrors },
    { data: banks },
    { data: clientCategories },
    { data: leadSources },
    { data: specialties },
    { data: vehicleBrands },
    { data: vehicleUsages },
    { data: currencies },
    { data: collectionCenters },
    { data: occupations },
    { data: claimCategories },
    { data: areas },
    { data: allInsuranceLines },
  ] = await Promise.all([
    isAdmin
      ? supabase.from("carriers").select("*").order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("agency_users").select("*").order("full_name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from("policy_installments")
          .select("amount, status, paid_amount, policies!inner(assigned_agent_id, status)")
          .neq("status", "paid")
          .not("policies.status", "in", "(draft,cancelled)")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("commission_payees").select("*").order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("broker_offices").select("*").order("is_direct", { ascending: false }).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("insurance_lines").select("id, name_el").eq("is_active", true).order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from("broker_offices")
          .select(
            "id, name, is_direct, is_active, commission_agreements(id, name, notes, is_active, carrier_commission_rates(id, carrier_id, insurance_line_id, default_commission_percent, valid_from, valid_to, is_active, carriers(name), insurance_lines(name_el)))",
          )
          .order("is_direct", { ascending: false })
          .order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from("commission_payees")
          .select(
            "id, name, is_external, is_active, commission_agreements(id, name, notes, is_active, carrier_commission_rates(id, carrier_id, insurance_line_id, default_commission_percent, valid_from, valid_to, is_active, carriers(name), insurance_lines(name_el)))",
          )
          .order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("payment_methods").select("*").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("app_settings").select("key, enabled, value").order("key")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("email_templates").select("*").order("is_system", { ascending: false }).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from("error_log")
          .select("id, context, message, url, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("banks").select("id, name, is_active").order("sort_order") : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("client_categories").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("lead_sources").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("specialties").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("vehicle_brands").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("vehicle_usages").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("currencies").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("collection_centers").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("occupations").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("claim_categories").select("id, name, is_active").order("sort_order")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("areas").select("id, postal_code, city, region, is_active").order("postal_code")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from("insurance_lines")
          .select(
            "id, code, name_el, requires_vehicle_details, requires_property_details, requires_life_health_details, is_active",
          )
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);

  const outstandingByAgent = new Map<string, number>();
  for (const row of outstandingRows ?? []) {
    const agentId = (row.policies as unknown as { assigned_agent_id: string | null } | null)
      ?.assigned_agent_id;
    if (!agentId) continue;
    outstandingByAgent.set(
      agentId,
      (outstandingByAgent.get(agentId) ?? 0) + installmentRemaining(row),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ρυθμίσεις</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Προφίλ</TabsTrigger>
          {isAdmin && <TabsTrigger value="carriers">Ασφαλιστικές εταιρείες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="team">Συνεργάτες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="payees">Δικαιούχοι Προμηθειών</TabsTrigger>}
          {isAdmin && <TabsTrigger value="brokers">Συνεργαζόμενα Γραφεία</TabsTrigger>}
          {isAdmin && <TabsTrigger value="agreements">Συμβάσεις Προμηθειών</TabsTrigger>}
          {isAdmin && <TabsTrigger value="payment-methods">Μέθοδοι Πληρωμής</TabsTrigger>}
          {isAdmin && <TabsTrigger value="parametric">Παραμετρικοί Πίνακες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="automations">Αυτοματισμοί</TabsTrigger>}
          {isAdmin && <TabsTrigger value="email-templates">Πρότυπα Email</TabsTrigger>}
          {isAdmin && <TabsTrigger value="errors">Σφάλματα</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileTab fullName={agencyUser.full_name} email={agencyUser.email} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="carriers" className="pt-4">
            <CarriersTab carriers={carriers ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="team" className="pt-4">
            <TeamTab
              users={users ?? []}
              currentUserId={agencyUser.id}
              outstandingByAgent={Object.fromEntries(outstandingByAgent)}
            />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="payees" className="pt-4">
            <PayeesTab payees={payees ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="brokers" className="pt-4">
            <BrokerOfficesTab brokerOffices={brokerOffices ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="agreements" className="pt-4">
            <CommissionAgreementsTab
              brokerOffices={(brokerOfficesWithAgreements ?? []) as unknown as BrokerOfficeWithAgreements[]}
              payees={(payeesWithAgreements ?? []) as unknown as PayeeWithAgreements[]}
              carriers={carriers ?? []}
              insuranceLines={insuranceLines ?? []}
            />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="payment-methods" className="pt-4">
            <PaymentMethodsTab paymentMethods={paymentMethods ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="parametric" className="pt-4">
            <Tabs defaultValue="banks">
              <TabsList className="flex-wrap">
                <TabsTrigger value="banks">Τράπεζες</TabsTrigger>
                <TabsTrigger value="client-categories">Κατηγορίες Πελατών</TabsTrigger>
                <TabsTrigger value="lead-sources">Πηγές Προέλευσης</TabsTrigger>
                <TabsTrigger value="specialties">Ειδικότητες</TabsTrigger>
                <TabsTrigger value="vehicle-brands">Μάρκες Οχημάτων</TabsTrigger>
                <TabsTrigger value="vehicle-usages">Χρήσεις Οχήματος</TabsTrigger>
                <TabsTrigger value="currencies">Νομίσματα</TabsTrigger>
                <TabsTrigger value="collection-centers">Κέντρα Είσπραξης</TabsTrigger>
                <TabsTrigger value="occupations">Επαγγέλματα</TabsTrigger>
                <TabsTrigger value="claim-categories">Κατηγορίες Ζημιών</TabsTrigger>
                <TabsTrigger value="areas">Περιοχές</TabsTrigger>
                <TabsTrigger value="insurance-lines">Κλάδοι Ασφάλισης</TabsTrigger>
              </TabsList>
              <TabsContent value="banks" className="pt-4">
                <BanksTab rows={banks ?? []} />
              </TabsContent>
              <TabsContent value="client-categories" className="pt-4">
                <ClientCategoriesTab rows={clientCategories ?? []} />
              </TabsContent>
              <TabsContent value="lead-sources" className="pt-4">
                <LeadSourcesTab rows={leadSources ?? []} />
              </TabsContent>
              <TabsContent value="specialties" className="pt-4">
                <SpecialtiesTab rows={specialties ?? []} />
              </TabsContent>
              <TabsContent value="vehicle-brands" className="pt-4">
                <VehicleBrandsTab rows={vehicleBrands ?? []} />
              </TabsContent>
              <TabsContent value="vehicle-usages" className="pt-4">
                <VehicleUsagesTab rows={vehicleUsages ?? []} />
              </TabsContent>
              <TabsContent value="currencies" className="pt-4">
                <CurrenciesTab rows={currencies ?? []} />
              </TabsContent>
              <TabsContent value="collection-centers" className="pt-4">
                <CollectionCentersTab rows={collectionCenters ?? []} />
              </TabsContent>
              <TabsContent value="occupations" className="pt-4">
                <OccupationsTab rows={occupations ?? []} />
              </TabsContent>
              <TabsContent value="claim-categories" className="pt-4">
                <ClaimCategoriesTab rows={claimCategories ?? []} />
              </TabsContent>
              <TabsContent value="areas" className="pt-4">
                <AreasTab areas={areas ?? []} />
              </TabsContent>
              <TabsContent value="insurance-lines" className="pt-4">
                <InsuranceLinesTab lines={allInsuranceLines ?? []} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="automations" className="pt-4">
            <AutomationsTab settings={appSettings ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="email-templates" className="pt-4">
            <EmailTemplatesTab templates={emailTemplates ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="errors" className="pt-4">
            <ErrorsTab errors={recentErrors ?? []} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
