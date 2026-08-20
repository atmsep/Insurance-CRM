"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTask, deleteTask } from "./actions";

type AgentOption = { id: string; full_name: string };

export function TaskActions({
  taskId,
  title,
  dueDate,
  priority,
  assignedTo,
  agents,
}: {
  taskId: string;
  title: string;
  dueDate: string;
  priority: string;
  assignedTo: string;
  agents: AgentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Επεξεργασία
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Επεξεργασία υπενθύμισης</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await updateTask(taskId, formData);
                if (result?.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Η υπενθύμιση ενημερώθηκε.");
                  setOpen(false);
                }
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`task-title-${taskId}`}>Τίτλος</Label>
              <Input id={`task-title-${taskId}`} name="title" defaultValue={title} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`task-due-${taskId}`}>Ημερομηνία</Label>
              <Input id={`task-due-${taskId}`} name="due_date" type="date" defaultValue={dueDate} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`task-priority-${taskId}`}>Προτεραιότητα</Label>
              <select
                id={`task-priority-${taskId}`}
                name="priority"
                defaultValue={priority}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="low">Χαμηλή</option>
                <option value="medium">Μεσαία</option>
                <option value="high">Υψηλή</option>
                <option value="urgent">Επείγουσα</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`task-assignee-${taskId}`}>Ανατεθειμένη σε</Label>
              <select
                id={`task-assignee-${taskId}`}
                name="assigned_to"
                defaultValue={assignedTo}
                className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (!window.confirm("Οριστική διαγραφή της υπενθύμισης;")) return;
                  startTransition(async () => {
                    const result = await deleteTask(taskId);
                    if (result?.error) {
                      toast.error(result.error);
                    } else {
                      toast.success("Η υπενθύμιση διαγράφηκε.");
                      setOpen(false);
                    }
                  });
                }}
              >
                Διαγραφή
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
