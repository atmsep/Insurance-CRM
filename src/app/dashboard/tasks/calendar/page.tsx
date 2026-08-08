import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DayCell } from "./day-cell";

const WEEKDAY_LABELS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const MONTH_LABELS = [
  "Ιανουάριος",
  "Φεβρουάριος",
  "Μάρτιος",
  "Απρίλιος",
  "Μάιος",
  "Ιούνιος",
  "Ιούλιος",
  "Αύγουστος",
  "Σεπτέμβριος",
  "Οκτώβριος",
  "Νοέμβριος",
  "Δεκέμβριος",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default async function TasksCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = new Date();
  const [year, monthIndex] = month
    ? month.split("-").map(Number)
    : [today.getFullYear(), today.getMonth() + 1];

  const firstOfMonth = new Date(year, monthIndex - 1, 1);
  const lastOfMonth = new Date(year, monthIndex, 0);
  const daysInMonth = lastOfMonth.getDate();
  // getDay(): 0=Sunday..6=Saturday. Convert to Monday-first index 0..6.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const rangeStart = `${year}-${pad(monthIndex)}-01`;
  const rangeEnd = `${year}-${pad(monthIndex)}-${pad(daysInMonth)}`;

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, status")
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .order("due_date", { ascending: true });

  const tasksByDay = new Map<number, typeof tasks>();
  for (const task of tasks ?? []) {
    const day = Number(task.due_date.slice(8, 10));
    const list = tasksByDay.get(day) ?? [];
    list.push(task);
    tasksByDay.set(day, list);
  }

  const prevMonth = new Date(year, monthIndex - 2, 1);
  const nextMonth = new Date(year, monthIndex, 1);
  const prevHref = `/dashboard/tasks/calendar?month=${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}`;
  const nextHref = `/dashboard/tasks/calendar?month=${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}`;

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth() + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Ημερολόγιο — {MONTH_LABELS[monthIndex - 1]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={prevHref}>←</Link>} />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/tasks">Λίστα</Link>} />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={nextHref}>→</Link>} />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium">
            {label}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="min-h-24 bg-muted/30 p-1.5" />;
          const dayTasks = tasksByDay.get(day) ?? [];
          const isToday = isCurrentMonth && day === today.getDate();
          const date = `${year}-${pad(monthIndex)}-${pad(day)}`;
          return <DayCell key={idx} day={day} date={date} isToday={isToday} tasks={dayTasks} />;
        })}
      </div>
    </div>
  );
}
