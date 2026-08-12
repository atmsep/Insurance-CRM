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
import { StatusSelect as TicketStatusSelect } from "../../../tickets/status-select";
import { AssigneeSelect } from "../../../tickets/assignee-select";
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

export function TicketsTab({
  clientId,
  tickets,
  agents,
  addTicketAction,
}: {
  clientId: string;
  tickets: Ticket[];
  agents: { id: string; full_name: string }[];
  addTicketAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Αιτήματα</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Θέμα</TableHead>
              <TableHead>Περιγραφή</TableHead>
              <TableHead>Ανάθεση</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Περιγραφή διεκπεραίωσης</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length ? (
              tickets.map((ticket) => (
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
                  Δεν υπάρχουν αιτήματα.
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
