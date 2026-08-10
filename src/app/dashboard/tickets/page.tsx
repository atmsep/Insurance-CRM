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
import { resolveClientName } from "@/lib/client-name";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
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
      "id, client_id, subject, status, priority, created_at, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)), agency_users!assigned_to(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  else if (open) query = query.not("status", "in", "(resolved,closed)");

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: tickets, count } = await query;
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
                const name = resolveClientName(client);

                return (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <BulkSelectCheckbox id={ticket.id} />
                    </TableCell>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
