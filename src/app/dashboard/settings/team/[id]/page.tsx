import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { installmentRemaining } from "../../../policies/balance";
import { updateAgencyUserProfile } from "../../actions";
import { AgentDetailsCard } from "./_components/agent-details-card";
import { AgentStatusToggle } from "./_components/agent-status-toggle";

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

  const [
    { count: clientsCount },
    { count: activePoliciesCount },
    { data: outstandingRows },
    { data: commissions },
  ] = await Promise.all([
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
    supabase
      .from("policy_installments")
      .select("amount, status, paid_amount, policies!inner(assigned_agent_id, status)")
      .neq("status", "paid")
      .not("policies.status", "in", "(draft,cancelled)")
      .eq("policies.assigned_agent_id", id),
    supabase
      .from("commissions")
      .select("commission_amount, status")
      .eq("agent_id", id)
      .eq("direction", "incoming"),
  ]);

  const outstanding = (outstandingRows ?? []).reduce((sum, row) => sum + installmentRemaining(row), 0);
  const commissionsPaid = (commissions ?? [])
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const commissionsPending = (commissions ?? [])
    .filter((c) => c.status !== "paid" && c.status !== "cancelled")
    .reduce((sum, c) => sum + c.commission_amount, 0);

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
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Ανεξόφλητο υπόλοιπο</span>
              <span className={`text-right font-medium ${outstanding > 0 ? "text-warning" : ""}`}>
                {outstanding.toFixed(2)} €
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Προμήθειες (πληρωμένες)</span>
              <span className="text-right font-medium">{commissionsPaid.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Προμήθειες (εκκρεμείς)</span>
              <span className="text-right font-medium">{commissionsPending.toFixed(2)} €</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
