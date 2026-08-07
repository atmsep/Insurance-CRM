import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { CarriersTab } from "./carriers-tab";
import { TeamTab } from "./team-tab";

export default async function SettingsPage() {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const supabase = await createClient();

  const [{ data: carriers }, { data: users }] = await Promise.all([
    isAdmin
      ? supabase.from("carriers").select("*").order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("agency_users").select("*").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ρυθμίσεις</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Προφίλ</TabsTrigger>
          {isAdmin && <TabsTrigger value="carriers">Ασφαλιστικές εταιρείες</TabsTrigger>}
          {isAdmin && <TabsTrigger value="team">Συνεργάτες</TabsTrigger>}
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
            <TeamTab users={users ?? []} currentUserId={agencyUser.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
