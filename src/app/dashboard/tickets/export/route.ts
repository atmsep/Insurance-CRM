import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { resolveClientName } from "@/lib/client-name";
import { TICKET_STATUS_LABELS } from "../ticket-labels";
import { formatDate } from "@/lib/date";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Χαμηλή",
  medium: "Μεσαία",
  high: "Υψηλή",
  urgent: "Επείγουσα",
};

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const open = searchParams.get("open");
  const ids = searchParams.get("ids");

  let query = supabase
    .from("client_tickets")
    .select(
      "subject, status, priority, created_at, resolution_notes, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)), agency_users!assigned_to(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (ids) {
    query = query.in("id", ids.split(","));
  } else {
    if (status) query = query.eq("status", status);
    else if (open) query = query.not("status", "in", "(resolved,closed)");
  }

  const { data: tickets } = await query;

  const rows = (tickets ?? []).map((t) => {
    const client = t.clients as unknown as {
      client_individuals: { first_name: string; last_name: string } | null;
      client_legal_entities: { company_name: string } | null;
    } | null;
    const agent = t.agency_users as unknown as { full_name: string } | null;
    return {
      client: resolveClientName(client),
      subject: t.subject,
      assigned_to: agent?.full_name ?? "",
      priority: PRIORITY_LABELS[t.priority] ?? t.priority,
      created_at: formatDate(t.created_at),
      status: TICKET_STATUS_LABELS[t.status] ?? t.status,
      resolution_notes: t.resolution_notes ?? "",
    };
  });

  const csv = toCsv(rows, [
    { key: "client", label: "Πελάτης" },
    { key: "subject", label: "Θέμα" },
    { key: "assigned_to", label: "Ανάθεση" },
    { key: "priority", label: "Προτεραιότητα" },
    { key: "created_at", label: "Ημ/νία" },
    { key: "status", label: "Κατάσταση" },
    { key: "resolution_notes", label: "Περιγραφή διεκπεραίωσης" },
  ]);

  return csvResponse(csv, "aitimata.csv");
}
