import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = addDays(30);

  const [
    { count: activePoliciesCount },
    { count: pendingTasksCount },
    { count: openClaimsCount },
    { data: expiringPolicies },
    { data: overdueInstallments },
    { data: upcomingTasks },
  ] = await Promise.all([
    supabase.from("policies").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(paid,closed)"),
    supabase
      .from("policies")
      .select("id, policy_number, end_date, clients(client_individuals(first_name,last_name), client_legal_entities(company_name))")
      .eq("status", "active")
      .lte("end_date", in30Days)
      .order("end_date", { ascending: true })
      .limit(8),
    supabase
      .from("policy_installments")
      .select("id, due_date, amount, policies(policy_number)")
      .in("status", ["pending", "overdue"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(8),
  ]);

  const overdueCount = overdueInstallments?.length ?? 0;
  const expiringCount = expiringPolicies?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Επισκόπηση</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Ενεργά συμβόλαια" value={activePoliciesCount ?? 0} />
        <StatTile label="Εκκρεμείς υπενθυμίσεις" value={pendingTasksCount ?? 0} />
        <StatTile
          label="Λήγουν σε 30 ημέρες"
          value={expiringCount}
          tone={expiringCount > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Ληξιπρόθεσμες δόσεις"
          value={overdueCount}
          tone={overdueCount > 0 ? "critical" : "neutral"}
        />
        <StatTile
          label="Ανοιχτές ζημιές"
          value={openClaimsCount ?? 0}
          tone={(openClaimsCount ?? 0) > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Συμβόλαια που λήγουν σύντομα</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {expiringPolicies?.length ? (
              expiringPolicies.map((policy) => {
                const client = policy.clients as unknown as {
                  client_individuals: { first_name: string; last_name: string } | null;
                  client_legal_entities: { company_name: string } | null;
                } | null;
                const name = client?.client_individuals
                  ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
                  : client?.client_legal_entities?.company_name ?? "—";
                return (
                  <Link
                    key={policy.id}
                    href={`/dashboard/policies/${policy.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span>
                      {policy.policy_number} · {name}
                    </span>
                    <Badge variant="outline">{formatDate(policy.end_date)}</Badge>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">Καμία λήξη τις επόμενες 30 ημέρες.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Εκκρεμείς υπενθυμίσεις</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcomingTasks?.length ? (
              upcomingTasks.map((task) => (
                <Link
                  key={task.id}
                  href="/dashboard/tasks"
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>{task.title}</span>
                  <Badge variant="outline">{formatDate(task.due_date)}</Badge>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν εκκρεμείς υπενθυμίσεις.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "critical";
}) {
  const toneClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-500"
        : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
