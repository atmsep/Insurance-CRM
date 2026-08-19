import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { AgencyProfileTab } from "./agency-profile-tab";
import { CarriersTab } from "./carriers-tab";
import { TeamTab } from "./team-tab";
import { BrokerOfficesTab } from "./broker-offices-tab";
import { AutomationsTab } from "./automations-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { ErrorsTab } from "./errors-tab";
import { ParametricTablesTab } from "./parametric-tables-tab";
import { getAgencyProfile, type AgencyProfile } from "@/lib/agency-profile";

export default async function SettingsPage() {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const supabase = await createClient();

  const emptyAgencyProfile: AgencyProfile = { name: null, address: null, phone: null, email: null, logoUrl: null };

  const [
    { data: carriers },
    { data: users },
    { data: brokerOffices },
    { data: appSettings },
    { data: emailTemplates },
    { data: recentErrors },
    agencyProfile,
  ] = await Promise.all([
    isAdmin
      ? supabase.from("carriers").select("*").order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("agency_users").select("*").order("full_name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("broker_offices").select("*").order("is_direct", { ascending: false }).order("name")
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
    isAdmin ? getAgencyProfile(supabase) : Promise.resolve(emptyAgencyProfile),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ρυθμίσεις</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Προφίλ</TabsTrigger>
          {isAdmin && <TabsTrigger value="agency">Στοιχεία Γραφείου</TabsTrigger>}
          {isAdmin && <TabsTrigger value="carriers">Ασφαλιστικές εταιρείες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="team">Συνεργάτες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="brokers">Συνεργαζόμενα Γραφεία</TabsTrigger>}
          {isAdmin && <TabsTrigger value="parametric">Παραμετρικοί Πίνακες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="automations">Αυτοματισμοί</TabsTrigger>}
          {isAdmin && <TabsTrigger value="email-templates">Πρότυπα Email</TabsTrigger>}
          {isAdmin && <TabsTrigger value="errors">Σφάλματα</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileTab fullName={agencyUser.full_name} email={agencyUser.email} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="agency" className="pt-4">
            <AgencyProfileTab profile={agencyProfile} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="carriers" className="pt-4">
            <CarriersTab carriers={carriers ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="team" className="pt-4">
            <TeamTab users={users ?? []} currentUserId={agencyUser.id} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="brokers" className="pt-4">
            <BrokerOfficesTab brokerOffices={brokerOffices ?? []} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="parametric" className="pt-4">
            <ParametricTablesTab />
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
