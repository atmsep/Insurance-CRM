import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "./date-utils";

export async function UpcomingTasksCard() {
  const supabase = await createClient();
  const { data: upcomingTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority")
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(8);

  return (
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
  );
}
