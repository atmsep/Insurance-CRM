"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { ColumnFilter, type SortDirection } from "./column-filter";
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

type Column = {
  key: string;
  label: string;
  getValue: (t: Task) => string;
  getSortKey: (t: Task) => string | number;
};

const COLUMNS: Column[] = [
  { key: "title", label: "Τίτλος", getValue: (t) => t.title, getSortKey: (t) => t.title },
  { key: "due_date", label: "Προθεσμία", getValue: (t) => formatDate(t.due_date), getSortKey: (t) => t.due_date },
  {
    key: "priority",
    label: "Προτεραιότητα",
    getValue: (t) => PRIORITY_LABELS[t.priority] ?? t.priority,
    getSortKey: (t) => PRIORITY_LABELS[t.priority] ?? t.priority,
  },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (t) => TASK_STATUS_LABELS[t.status] ?? t.status,
    getSortKey: (t) => TASK_STATUS_LABELS[t.status] ?? t.status,
  },
];

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
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const t of tasks) {
        const value = col.getValue(t);
        if (!seen.has(value)) seen.set(value, col.getSortKey(t));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((t) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(t));
      }),
    );
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a);
      const kb = col.getSortKey(b);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [tasks, filters, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Υπενθυμίσεις</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={col.label}
                    options={optionsByColumn.get(col.key) ?? []}
                    active={filters[col.key] ?? null}
                    onChange={(next) => setFilters((f) => ({ ...f, [col.key]: next }))}
                    sortDirection={sort?.key === col.key ? sort.direction : null}
                    onSort={(direction) => setSort(direction ? { key: col.key, direction } : null)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTasks.length ? (
              visibleTasks.map((task) => (
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
                  {tasks.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν υπενθυμίσεις."}
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
