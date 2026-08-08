import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import { TICKET_STATUS_LABELS } from "./ticket-labels";
import { ticketStatusVariant, taskPriorityVariant } from "@/lib/status-badge";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; open?: string }>;
}) {
  const { status, open } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("client_tickets")
    .select(
      "id, client_id, subject, status, priority, created_at, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)), agency_users!assigned_to(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  else if (open) query = query.not("status", "in", "(resolved,closed)");

  const { data: tickets } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Αιτήματα</h1>
        {open && !status && (
          <p className="text-sm text-muted-foreground">
            Μόνο ανοιχτά αιτήματα ·{" "}
            <Link href="/dashboard/tickets" className="hover:underline">
              Καθαρισμός φίλτρου
            </Link>
          </p>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Όλες οι καταστάσεις</option>
          {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Φίλτρο
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Θέμα</TableHead>
              <TableHead>Ανάθεση</TableHead>
              <TableHead>Προτεραιότητα</TableHead>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Κατάσταση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.length ? (
              tickets.map((ticket) => {
                const client = ticket.clients as unknown as {
                  client_individuals: { first_name: string; last_name: string } | null;
                  client_legal_entities: { company_name: string } | null;
                } | null;
                const agent = ticket.agency_users as unknown as { full_name: string } | null;
                const name = client?.client_individuals
                  ? `${client.client_individuals.first_name} ${client.client_individuals.last_name}`
                  : client?.client_legal_entities?.company_name ?? "—";

                return (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Link href={`/dashboard/clients/${ticket.client_id}`} className="hover:underline">
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>{agent?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={taskPriorityVariant(ticket.priority)}>
                        {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(ticket.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={ticketStatusVariant(ticket.status)}>
                        {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Δεν υπάρχουν αιτήματα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
