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
import type { TicketStatus } from "@/lib/database.types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  created_at: string;
};

export function TicketsTab({
  clientId,
  tickets,
  addTicketAction,
}: {
  clientId: string;
  tickets: Ticket[];
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
              <TableHead>Κατάσταση</TableHead>
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
                    <TicketStatusSelect
                      ticketId={ticket.id}
                      clientId={clientId}
                      status={ticket.status as TicketStatus}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
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
