import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CELEBRATION_ICONS,
  CELEBRATION_LABELS,
  buildCelebrationWish,
  isCelebrationType,
  type CelebrationType,
} from "@/lib/celebrations";
import { getCelebrationTemplatesCached } from "@/lib/cached-queries/lookups";
import { formatDate, todayISO } from "./date-utils";
import { AgendaItemsList } from "./agenda-items-list";

export type AgendaItem =
  | { key: string; label: string; href: string; kind: "task" }
  | {
      key: string;
      label: string;
      kind: "celebration";
      celebrationType: CelebrationType;
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

// Expiring-today policies are deliberately not included here — they're
// already covered by the "Συμβόλαια που λήγουν σύντομα" card further down
// this same page, so listing them here too was just noise.
export async function TodayAgendaCard() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: todayTasks }, celebrationTemplates] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, task_type, clients(email, display_name)")
      .eq("status", "pending")
      .eq("due_date", today)
      .order("priority", { ascending: false }),
    getCelebrationTemplatesCached(),
  ]);

  const agendaItems: AgendaItem[] = ((todayTasks ?? []) as unknown as TodayTaskRow[]).map((t): AgendaItem => {
    if (isCelebrationType(t.task_type)) {
      const client = Array.isArray(t.clients) ? (t.clients[0] ?? null) : t.clients;
      const wish = buildCelebrationWish(celebrationTemplates[t.task_type], client?.display_name ?? "τον πελάτη");
      return {
        key: `task-${t.id}`,
        label: t.title,
        kind: "celebration",
        celebrationType: t.task_type,
        taskId: t.id,
        icon: CELEBRATION_ICONS[t.task_type],
        celebrationLabel: CELEBRATION_LABELS[t.task_type],
        clientEmail: client?.email ?? null,
        subject: wish.subject,
        body: wish.body,
      };
    }
    return { key: `task-${t.id}`, label: t.title, href: "/dashboard/tasks", kind: "task" as const };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Σήμερα — {formatDate(today)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <AgendaItemsList items={agendaItems} />
      </CardContent>
    </Card>
  );
}
