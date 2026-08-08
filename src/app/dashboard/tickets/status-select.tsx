"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTicketStatus } from "./actions";
import { TICKET_STATUS_LABELS } from "./ticket-labels";
import type { TicketStatus } from "@/lib/database.types";

const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][];

export function StatusSelect({
  ticketId,
  clientId,
  status,
}: {
  ticketId: string;
  clientId: string;
  status: TicketStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) => {
        if (value) startTransition(() => updateTicketStatus(ticketId, clientId, value));
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue>
          {(value: TicketStatus) => TICKET_STATUS_LABELS[value] ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
