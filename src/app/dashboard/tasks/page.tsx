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

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function TasksPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Υπενθυμίσεις</h1>
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
        {tasks?.length ? (
          tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(task.due_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={taskPriorityVariant(task.priority)}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </Badge>
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
