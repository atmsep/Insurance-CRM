"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity, logActivityBatch } from "@/lib/activity-log";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function createTicket(clientId: string, formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const subject = str(formData, "subject");
  if (!subject) return;

  await supabase.from("client_tickets").insert({
    client_id: clientId,
    subject,
    description: str(formData, "description"),
    priority: str(formData, "priority") ?? "medium",
    assigned_to: agencyUser.id,
    created_by: agencyUser.id,
  });

  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: "ticket_created",
    description: `Καταχωρήθηκε νέο αίτημα: ${subject}`,
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}

export async function updateTicketStatus(ticketId: string, clientId: string, status: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("client_tickets")
    .update({
      status,
      resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", ticketId);

  await logActivity(supabase, {
    entityType: "client",
    entityId: clientId,
    action: "ticket_status_changed",
    description: `Η κατάσταση ενός αιτήματος άλλαξε σε "${status}".`,
    actorId: agencyUser.id,
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}

export async function bulkUpdateTicketStatus(
  ticketIds: string[],
  status: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  if (ticketIds.length === 0) return;
  const supabase = await createSupabaseClient();

  const { data: tickets } = await supabase
    .from("client_tickets")
    .select("id, client_id")
    .in("id", ticketIds);

  const { error } = await supabase
    .from("client_tickets")
    .update({
      status,
      resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
    })
    .in("id", ticketIds);

  if (error) {
    return { error: "Σφάλμα κατά τη μαζική ενημέρωση: " + error.message };
  }

  await logActivityBatch(
    supabase,
    (tickets ?? []).map((ticket) => ({
      entityType: "client",
      entityId: ticket.client_id,
      action: "ticket_status_changed",
      description: `Η κατάσταση ενός αιτήματος άλλαξε σε "${status}" (μαζική ενέργεια).`,
      actorId: agencyUser.id,
    })),
  );

  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
  for (const ticket of tickets ?? []) {
    revalidatePath(`/dashboard/clients/${ticket.client_id}`);
  }
}
