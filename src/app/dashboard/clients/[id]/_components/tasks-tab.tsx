import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { taskPriorityVariant } from "@/lib/status-badge";

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

type Task = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string;
};

// Read-only roll-up — full task management (creating/completing tasks)
// stays on the dedicated Υπενθυμίσεις page.
export function TasksTab({ tasks }: { tasks: Task[] }) {
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
