"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusSelect as TicketStatusSelect } from "../../../tickets/status-select";
import { AssigneeSelect } from "../../../tickets/assignee-select";
import { TICKET_STATUS_LABELS } from "../../../tickets/ticket-labels";
import type { TicketStatus } from "@/lib/database.types";
import { formatDateTime } from "@/lib/date";

type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  created_at: string;
  assigned_to: string | null;
  resolution_notes: string | null;
};

type Agent = { id: string; full_name: string };

type Column = {
  key: string;
  label: string;
  getValue: (t: Ticket, agentName: (id: string | null) => string) => string;
  getSortKey: (t: Ticket, agentName: (id: string | null) => string) => string | number;
};

const COLUMNS: Column[] = [
  {
    key: "created_at",
    label: "Ημ/νία",
    getValue: (t) => formatDateTime(t.created_at),
    getSortKey: (t) => t.created_at,
  },
  { key: "subject", label: "Θέμα", getValue: (t) => t.subject, getSortKey: (t) => t.subject },
  {
    key: "description",
    label: "Περιγραφή",
    getValue: (t) => t.description ?? "—",
    getSortKey: (t) => t.description ?? "",
  },
  {
    key: "assigned_to",
    label: "Ανάθεση",
    getValue: (t, agentName) => agentName(t.assigned_to),
    getSortKey: (t, agentName) => agentName(t.assigned_to),
  },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (t) => TICKET_STATUS_LABELS[t.status] ?? t.status,
    getSortKey: (t) => TICKET_STATUS_LABELS[t.status] ?? t.status,
  },
  {
    key: "resolution_notes",
    label: "Περιγραφή διεκπεραίωσης",
    getValue: (t) => t.resolution_notes ?? "—",
    getSortKey: (t) => t.resolution_notes ?? "",
  },
];

export function TicketsTab({
  clientId,
  tickets,
  agents,
  addTicketAction,
}: {
  clientId: string;
  tickets: Ticket[];
  agents: Agent[];
  addTicketAction: (formData: FormData) => void | Promise<void>;
}) {
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const agentName = useMemo(() => {
    const byId = new Map(agents.map((a) => [a.id, a.full_name]));
    return (id: string | null) => (id ? (byId.get(id) ?? "—") : "—");
  }, [agents]);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const t of tickets) {
        const value = col.getValue(t, agentName);
        if (!seen.has(value)) seen.set(value, col.getSortKey(t, agentName));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [tickets, agentName]);

  const visibleTickets = useMemo(() => {
    const filtered = tickets.filter((t) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(t, agentName));
      }),
    );
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a, agentName);
      const kb = col.getSortKey(b, agentName);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [tickets, filters, sort, agentName]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Αιτήματα</CardTitle>
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
            {visibleTickets.length ? (
              visibleTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(ticket.created_at)}</TableCell>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell className="max-w-xs truncate">{ticket.description ?? "—"}</TableCell>
                  <TableCell>
                    <AssigneeSelect
                      ticketId={ticket.id}
                      clientId={clientId}
                      assignedTo={ticket.assigned_to}
                      agents={agents}
                    />
                  </TableCell>
                  <TableCell>
                    <TicketStatusSelect
                      ticketId={ticket.id}
                      clientId={clientId}
                      status={ticket.status as TicketStatus}
                      resolutionNotes={ticket.resolution_notes}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={ticket.resolution_notes ?? undefined}>
                    {ticket.resolution_notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {tickets.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν αιτήματα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form action={addTicketAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-subject">Θέμα</Label>
            <Input id="ticket-subject" name="subject" required className="w-56" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-description">Περιγραφή</Label>
            <Input id="ticket-description" name="description" className="w-72" />
          </div>
          <Button type="submit" variant="secondary">
            Καταχώρηση
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
