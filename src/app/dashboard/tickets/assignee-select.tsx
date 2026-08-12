"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignTicket } from "./actions";

export function AssigneeSelect({
  ticketId,
  clientId,
  assignedTo,
  agents,
}: {
  ticketId: string;
  clientId: string;
  assignedTo: string | null;
  agents: { id: string; full_name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={assignedTo ?? ""}
      disabled={pending}
      onValueChange={(value) => {
        if (value) startTransition(() => assignTicket(ticketId, clientId, value));
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue>
          {(value: string) => agents.find((a) => a.id === value)?.full_name ?? "Μη ανατεθειμένο"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
