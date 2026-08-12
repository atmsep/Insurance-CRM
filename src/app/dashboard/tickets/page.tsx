import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ListPageHeader } from "@/components/list-page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  BulkSelectionProvider,
  BulkSelectCheckbox,
  BulkSelectAllCheckbox,
} from "@/components/bulk-selection";
import { BulkStatusBar } from "@/components/bulk-status-bar";
import { bulkUpdateTicketStatus } from "./actions";
import { ClickableRow } from "@/components/clickable-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TICKET_STATUS_LABELS } from "./ticket-labels";
import { taskPriorityVariant } from "@/lib/status-badge";
import { resolveClientName } from "@/lib/client-name";
import { StatusSelect } from "./status-select";
import { AssigneeSelect } from "./assignee-select";
import type { TicketStatus } from "@/lib/database.types";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; open?: string; page?: string }>;
}) {
  const { status, open, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("client_tickets")
    .select(
      "id, client_id, subject, status, priority, created_at, assigned_to, resolution_notes, clients(client_individuals(first_name,last_name), client_legal_entities(company_name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  else if (open) query = query.not("status", "in", "(resolved,closed)");

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const [{ data: tickets, count }, { data: agents }] = await Promise.all([
    query,
    supabase.from("agency_users").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (status) exportParams.set("status", status);
  if (open) exportParams.set("open", open);

  return (
    <div className="flex flex-col gap-6">
      <ListPageHeader
        title="Αιτήματα"
        filterBanner={
          open && !status ? { label: "Μόνο ανοιχτά αιτήματα", clearHref: "/dashboard/tickets" } : undefined
        }
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/dashboard/tickets/export?${exportParams.toString()}`}>Εξαγωγή</a>}
          />
        }
      />

      <BulkSelectionProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <BulkSelectAllCheckbox ids={(tickets ?? []).map((t) => t.id)} />
              </TableHead>
              <TableHead>Πελάτης</TableHead>
              <TableHead>Θέμα</TableHead>
              <TableHead>Ανάθεση</TableHead>
              <TableHead>Προτεραιότητα</TableHead>
              <TableHead>Ημ/νία</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Περιγραφή διεκπεραίωσης</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2" />
              <TableHead className="pb-2">
                <FilterSelect
                  form="ticket-filters"
                  name="status"
                  defaultValue={status ?? ""}
                  allLabel="Όλες οι καταστάσεις"
                  options={Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ id: value, label }))}
                />
              </TableHead>
              <TableHead className="pb-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.length ? (
              tickets.map((ticket) => {
                const client = ticket.clients as unknown as {
                  client_individuals: { first_name: string; last_name: string } | null;
                  client_legal_entities: { company_name: string } | null;
                } | null;
                const name = resolveClientName(client);

                return (
                  <ClickableRow key={ticket.id} href={`/dashboard/clients/${ticket.client_id}`}>
                    <TableCell>
                      <BulkSelectCheckbox id={ticket.id} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/clients/${ticket.client_id}`} className="hover:underline">
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>
                      <AssigneeSelect
                        ticketId={ticket.id}
                        clientId={ticket.client_id}
                        assignedTo={ticket.assigned_to}
                        agents={agents ?? []}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={taskPriorityVariant(ticket.priority)}>
                        {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(ticket.created_at)}</TableCell>
                    <TableCell>
                      <StatusSelect
                        ticketId={ticket.id}
                        clientId={ticket.client_id}
                        status={ticket.status as TicketStatus}
                        resolutionNotes={ticket.resolution_notes}
                      />
                    </TableCell>
                    <TableCell className="max-w-56 truncate" title={ticket.resolution_notes ?? undefined}>
                      {ticket.resolution_notes ?? "—"}
                    </TableCell>
                  </ClickableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Δεν υπάρχουν αιτήματα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <BulkStatusBar
        statusOptions={Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        applyAction={bulkUpdateTicketStatus}
        exportBasePath="/dashboard/tickets/export"
      />
      </BulkSelectionProvider>

      <form id="ticket-filters" className="flex flex-wrap items-center justify-between gap-3">
        {open && <input type="hidden" name="open" value={open} />}
        <Button type="submit" variant="secondary" size="sm">
          Εφαρμογή φίλτρων
        </Button>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/dashboard/tickets"
          searchParams={{ status, open }}
        />
      </form>
    </div>
  );
}
