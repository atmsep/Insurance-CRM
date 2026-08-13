import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { taskPriorityVariant } from "@/lib/status-badge";
import { formatDate } from "@/lib/date";

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Εκκρεμεί",
  in_progress: "Σε εξέλιξη",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

type Task = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string;
};

// Listing + inline creation here; completing/reassigning a task still
// stays on the dedicated /dashboard/tasks page (linked below).
export function TasksTab({
  tasks,
  clientId,
  addTaskAction,
}: {
  tasks: Task[];
  clientId: string;
  addTaskAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Υπενθυμίσεις</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Τίτλος</TableHead>
              <TableHead>Προθεσμία</TableHead>
              <TableHead>Προτεραιότητα</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length ? (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.title}</TableCell>
                  <TableCell>{formatDate(task.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={taskPriorityVariant(task.priority)}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{TASK_STATUS_LABELS[task.status] ?? task.status}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Δεν υπάρχουν υπενθυμίσεις.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form action={addTaskAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Τίτλος</Label>
            <Input id="task-title" name="title" required className="w-56" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due-date">Προθεσμία</Label>
            <Input id="task-due-date" name="due_date" type="date" required className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-priority">Προτεραιότητα</Label>
            <select
              id="task-priority"
              name="priority"
              defaultValue="medium"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Προσθήκη ενέργειας
          </Button>
        </form>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          nativeButton={false}
          render={<Link href="/dashboard/tasks">Διαχείριση υπενθυμίσεων</Link>}
        />
      </CardContent>
    </Card>
  );
}
