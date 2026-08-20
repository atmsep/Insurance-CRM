import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateAgencyUserProfile } from "../../actions";
import { AgentDetailsCard } from "./_components/agent-details-card";
import { AgentStatusToggle } from "./_components/agent-status-toggle";
import { SetPasswordCard } from "./_components/set-password-card";
import { TransferPortfolioCard } from "./_components/transfer-portfolio-card";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await requireAgencyUser();
  const isAdmin = currentUser.role === "owner" || currentUser.role === "admin";
  if (!isAdmin) notFound();

  const supabase = await createClient();

  const { data: agent } = await supabase.from("agency_users").select("*").eq("id", id).single();
  if (!agent) notFound();

  const { data: activeAgents } = await supabase
    .from("agency_users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  const [{ count: clientsCount }, { count: activePoliciesCount }] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("assigned_agent_id", id)
      .eq("is_active", true),
    supabase
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("assigned_agent_id", id)
      .eq("status", "active")
      .eq("is_current_term", true),
  ]);

  const updateAction = updateAgencyUserProfile.bind(null, id);
  const isSelf = agent.id === currentUser.id;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: "Ρυθμίσεις", href: "/dashboard/settings" }, { label: agent.full_name }]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{agent.full_name}</h1>
        <AgentStatusToggle userId={agent.id} isActive={agent.is_active} isSelf={isSelf} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgentDetailsCard agent={agent} isSelf={isSelf} updateAction={updateAction} />
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Επισκόπηση απόδοσης</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ανατεθειμένοι πελάτες</span>
                <span className="text-right font-medium">{clientsCount ?? 0}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ενεργά συμβόλαια</span>
                <span className="text-right font-medium">{activePoliciesCount ?? 0}</span>
              </div>
            </CardContent>
          </Card>
          <SetPasswordCard userId={agent.id} />
          <TransferPortfolioCard
            fromUserId={agent.id}
            fromUserName={agent.full_name}
            agents={activeAgents ?? []}
          />
        </div>
      </div>
    </div>
  );
}
