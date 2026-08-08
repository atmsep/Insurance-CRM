import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "./profile-tab";
import { CarriersTab } from "./carriers-tab";
import { TeamTab } from "./team-tab";
import { PayeesTab } from "./payees-tab";

export default async function SettingsPage() {
  const agencyUser = await requireAgencyUser();
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  const supabase = await createClient();

  const [{ data: carriers }, { data: users }, { data: outstandingRows }, { data: payees }] =
    await Promise.all([
      isAdmin
        ? supabase.from("carriers").select("*").order("name")
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase.from("agency_users").select("*").order("full_name")
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase
            .from("policy_installments")
            .select("amount, status, policies!inner(assigned_agent_id)")
            .in("status", ["pending", "overdue", "partially_paid"])
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase.from("commission_payees").select("*").order("name")
        : Promise.resolve({ data: [] }),
    ]);

  const outstandingByAgent = new Map<string, number>();
  for (const row of outstandingRows ?? []) {
    const agentId = (row.policies as unknown as { assigned_agent_id: string | null } | null)
      ?.assigned_agent_id;
    if (!agentId) continue;
    outstandingByAgent.set(agentId, (outstandingByAgent.get(agentId) ?? 0) + row.amount);
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
      </Tabs>
    </div>
  );
}
