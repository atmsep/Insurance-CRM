"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTask } from "../actions";

type DayTask = { id: string; title: string; priority: string };

const PRIORITY_VARIANT: Record<string, "outline" | "default" | "destructive"> = {
  low: "outline",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

export function DayCell({
  day,
  date,
  isToday,
  tasks,
}: {
  day: number;
  date: string;
  isToday: boolean;
  tasks: DayTask[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="group relative min-h-24 bg-background p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Προσθήκη υπενθύμισης στις ${date}`}
          onClick={() => setOpen(true)}
          className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
        <p className={`text-right ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{day}</p>
      </div>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <Badge
            key={task.id}
            variant={PRIORITY_VARIANT[task.priority] ?? "outline"}
            className="block w-full truncate text-left"
            title={task.title}
          >
            {task.title}
          </Badge>
        ))}
      </div>

      {open && (
        <div
          className="absolute left-1 top-7 z-20 w-52 rounded-md border bg-popover p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <form action={createTask} onSubmit={() => setOpen(false)} className="flex flex-col gap-2">
            <input type="hidden" name="due_date" value={date} />
            <Input name="title" placeholder="Τίτλος υπενθύμισης..." required autoFocus className="text-sm" />
            <Button type="submit" size="sm">
              Προσθήκη
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
