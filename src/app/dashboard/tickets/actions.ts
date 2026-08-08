"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

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

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}

export async function updateTicketStatus(ticketId: string, clientId: string, status: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("client_tickets")
    .update({
      status,
      resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", ticketId);

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}
