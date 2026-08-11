import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveClientName } from "@/lib/client-name";
import { CelebrationWishDialog } from "./tasks/celebration-wish-dialog";
import {
  CELEBRATION_ICONS,
  CELEBRATION_LABELS,
  buildCelebrationWish,
  getCelebrationTemplates,
  isCelebrationType,
} from "@/lib/celebrations";

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
    { count: openTicketsCount },
    { data: expiringPolicies },
    { count: outstandingCount },
    { data: upcomingTasks },
    { data: todayTasks },
    { data: todayCollections },
    { data: todayExpiring },
    celebrationTemplates,
  ] = await Promise.all([
    supabase
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_current_term", true),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(paid,closed)"),
    supabase
      .from("client_tickets")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(resolved,closed)"),
    supabase
      .from("policies")
      .select("id, policy_number, end_date, clients(client_individuals(first_name,last_name), client_legal_entities(company_name))")
      .in("status", ["active", "pending_renewal"])
      .eq("is_current_term", true)
      .lte("end_date", in30Days)
      .order("end_date", { ascending: true })
      .limit(8),
    // Every policy issued (not a draft, not itself cancelled) that hasn't
    // been fully collected — no due-date cutoff, so this matches the
    // "Ανείσπρακτα" worklist exactly, not just what's already overdue.
    supabase
      .from("policy_installments")
      .select("id, policies!inner(status)", { count: "exact", head: true })
      .neq("status", "paid")
      .not("policies.status", "in", "(draft,cancelled)"),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("tasks")
      .select("id, title, priority, task_type, clients(email, display_name)")
      .eq("status", "pending")
      .eq("due_date", today)
      .order("priority", { ascending: false }),
    supabase
      .from("policy_installments")
      .select("id, amount, policy_id, policies!inner(policy_number, status)")
      .neq("status", "paid")
      .not("policies.status", "in", "(draft,cancelled)")
      .eq("due_date", today),
    supabase
      .from("policies")
      .select("id, policy_number")
      .in("status", ["active", "pending_renewal"])
      .eq("is_current_term", true)
      .eq("end_date", today),
    getCelebrationTemplates(supabase),
  ]);

  const outstanding = outstandingCount ?? 0;
  const expiringCount = expiringPolicies?.length ?? 0;

  type AgendaItem =
    | { key: string; label: string; href: string; kind: "task" | "collection" | "expiring" }
    | {
        key: string;
        label: string;
        kind: "celebration";
        taskId: string;
        icon: string;
        celebrationLabel: string;
        clientEmail: string | null;
        subject: string;
        body: string;
      };

  type TodayTaskRow = {
    id: string;
    title: string;
    task_type: string;
    clients: { email: string | null; display_name: string | null } | { email: string | null; display_name: string | null }[] | null;
  };

  const agendaItems: AgendaItem[] = [
    ...((todayTasks ?? []) as unknown as TodayTaskRow[]).map((t): AgendaItem => {
      if (isCelebrationType(t.task_type)) {
        const client = Array.isArray(t.clients) ? (t.clients[0] ?? null) : t.clients;
        const wish = buildCelebrationWish(celebrationTemplates[t.task_type], client?.display_name ?? "τον πελάτη");
        return {
          key: `task-${t.id}`,
          label: t.title,
          kind: "celebration",
          taskId: t.id,
          icon: CELEBRATION_ICONS[t.task_type],
          celebrationLabel: CELEBRATION_LABELS[t.task_type],
          clientEmail: client?.email ?? null,
          subject: wish.subject,
          body: wish.body,
        };
      }
      return { key: `task-${t.id}`, label: t.title, href: "/dashboard/tasks", kind: "task" as const };
    }),
    ...(todayCollections ?? []).map((i) => ({
      key: `inst-${i.id}`,
      label: `Είσπραξη ${(i.policies as unknown as { policy_number: string } | null)?.policy_number ?? "—"} — ${i.amount.toFixed(2)} €`,
      href: `/dashboard/policies/${i.policy_id}`,
      kind: "collection" as const,
    })),
    ...(todayExpiring ?? []).map((p) => ({
      key: `exp-${p.id}`,
      label: `Λήξη συμβολαίου ${p.policy_number}`,
      href: `/dashboard/policies/${p.id}`,
      kind: "expiring" as const,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Επισκόπηση</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Σήμερα — {formatDate(today)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {agendaItems.length ? (
            agendaItems.map((item) =>
              item.kind === "celebration" ? (
                <CelebrationWishDialog
                  key={item.key}
                  taskId={item.taskId}
                  clientEmail={item.clientEmail}
                  initialSubject={item.subject}
                  initialBody={item.body}
                >
                  <div className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span>
                      {item.icon} {item.label}
                    </span>
                    <Badge variant="secondary">{item.celebrationLabel}</Badge>
                  </div>
                </CelebrationWishDialog>
              ) : (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>{item.label}</span>
                  <Badge
                    variant={
                      item.kind === "collection"
                        ? "destructive"
                        : item.kind === "expiring"
                          ? "outline"
                          : "default"
                    }
                  >
                    {item.kind === "task"
                      ? "Υπενθύμιση"
                      : item.kind === "collection"
                        ? "Είσπραξη"
                        : "Λήξη"}
                  </Badge>
                </Link>
              ),
            )
          ) : (
            <p className="text-sm text-muted-foreground">Δεν έχεις τίποτα προγραμματισμένο για σήμερα.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatTile
          label="Ενεργά συμβόλαια"
          value={activePoliciesCount ?? 0}
          href="/dashboard/policies?status=active"
        />
        <StatTile
          label="Εκκρεμείς υπενθυμίσεις"
          value={pendingTasksCount ?? 0}
          href="/dashboard/tasks"
        />
        <StatTile
          label="Λήγουν σε 30 ημέρες"
          value={expiringCount}
          tone={expiringCount > 0 ? "warning" : "neutral"}
          href="/dashboard/policies?expiring=30"
        />
        <StatTile
          label="Ανείσπρακτα"
          value={outstanding}
          tone={outstanding > 0 ? "critical" : "neutral"}
          href="/dashboard/installments"
        />
        <StatTile
          label="Ανοιχτές ζημιές"
          value={openClaimsCount ?? 0}
          tone={(openClaimsCount ?? 0) > 0 ? "warning" : "neutral"}
          href="/dashboard/claims?open=1"
        />
        <StatTile
          label="Ανοιχτά αιτήματα"
          value={openTicketsCount ?? 0}
          tone={(openTicketsCount ?? 0) > 0 ? "warning" : "neutral"}
          href="/dashboard/tickets?open=1"
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
                const name = resolveClientName(client);
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
  href,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "critical";
  href?: string;
}) {
  const toneClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";

  const content = (
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="transition-colors hover:bg-muted/50">{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
