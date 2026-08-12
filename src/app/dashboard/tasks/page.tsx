import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTask, completeTask } from "./actions";
import { PrioritySelect } from "./priority-select";
import { taskPriorityVariant } from "@/lib/status-badge";
import { CelebrationWishDialog } from "./celebration-wish-dialog";
import {
  CELEBRATION_ICONS,
  CELEBRATION_LABELS,
  buildCelebrationWish,
  getCelebrationTemplates,
  isCelebrationType,
} from "@/lib/celebrations";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

type TaskRow = {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  task_type: string;
  clients: { email: string | null; display_name: string | null } | { email: string | null; display_name: string | null }[] | null;
};

const LIST_CAP = 300;

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: tasks, count }, templates] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, task_type, clients(email, display_name)", {
        count: "exact",
      })
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(LIST_CAP),
    getCelebrationTemplates(supabase),
  ]);
  const isTruncated = (count ?? 0) > LIST_CAP;

  const rows = ((tasks ?? []) as unknown as TaskRow[]).map((task) => {
    const client = Array.isArray(task.clients) ? (task.clients[0] ?? null) : task.clients;
    const celebration = isCelebrationType(task.task_type)
      ? {
          icon: CELEBRATION_ICONS[task.task_type],
          label: CELEBRATION_LABELS[task.task_type],
          clientEmail: client?.email ?? null,
          ...buildCelebrationWish(templates[task.task_type], client?.display_name ?? "τον πελάτη"),
        }
      : null;
    return { id: task.id, title: task.title, due_date: task.due_date, priority: task.priority, celebration };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Υπενθυμίσεις</h1>
          {isTruncated && (
            <p className="text-sm text-muted-foreground">
              Εμφανίζονται {LIST_CAP} από {count} — ολοκλήρωσε τις παλαιότερες για να δεις τις υπόλοιπες.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/tasks/calendar">Προβολή ημερολογίου</Link>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Νέα υπενθύμιση</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTask} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Τίτλος</Label>
              <Input id="title" name="title" required className="w-64" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Ημερομηνία</Label>
              <Input id="due_date" name="due_date" type="date" required className="w-40" />
            </div>
            <PrioritySelect />
            <Button type="submit">Προσθήκη</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {rows.length ? (
          rows.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(task.due_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {task.celebration && (
                    <Badge variant="secondary">
                      {task.celebration.icon} {task.celebration.label}
                    </Badge>
                  )}
                  <Badge variant={taskPriorityVariant(task.priority)}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </Badge>
                  {task.celebration && (
                    <CelebrationWishDialog
                      taskId={task.id}
                      clientEmail={task.celebration.clientEmail}
                      initialSubject={task.celebration.subject}
                      initialBody={task.celebration.body}
                    >
                      <Button type="button" size="sm">
                        Αποστολή ευχών
                      </Button>
                    </CelebrationWishDialog>
                  )}
                  <form action={completeTask.bind(null, task.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      Ολοκληρώθηκε
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν εκκρεμείς υπενθυμίσεις.</p>
        )}
      </div>
    </div>
  );
}
