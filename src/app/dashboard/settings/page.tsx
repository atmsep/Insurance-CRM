import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { installmentRemaining } from "../policies/balance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { CarriersTab } from "./carriers-tab";
import { TeamTab } from "./team-tab";
import { PayeesTab } from "./payees-tab";
import { BrokerOfficesTab } from "./broker-offices-tab";
import { PaymentMethodsTab } from "./payment-methods-tab";
import { AutomationsTab } from "./automations-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { ErrorsTab } from "./errors-tab";

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
    { data: commissionRates },
    { data: paymentMethods },
    { data: appSettings },
    { data: emailTemplates },
    { data: recentErrors },
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
          .from("carrier_commission_rates")
          .select(
            "id, default_commission_percent, valid_from, valid_to, is_active, broker_offices(name), carriers(name), insurance_lines(name_el)",
          )
          .order("valid_from", { ascending: false })
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
          {isAdmin && <TabsTrigger value="payment-methods">Μέθοδοι Πληρωμής</TabsTrigger>}
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
            <BrokerOfficesTab
              brokerOffices={brokerOffices ?? []}
              carriers={carriers ?? []}
              insuranceLines={insuranceLines ?? []}
              rates={commissionRates ?? []}
            />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="payment-methods" className="pt-4">
            <PaymentMethodsTab paymentMethods={paymentMethods ?? []} />
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
