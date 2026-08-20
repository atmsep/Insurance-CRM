import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

// GDPR data-portability export — everything the CRM holds about one
// client, as a single JSON download. Admin-only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: individual },
    { data: legalEntity },
    { data: policies },
    { data: interactions },
    { data: tickets },
    { data: calls },
    { data: documents },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_individuals").select("*").eq("client_id", id).maybeSingle(),
    supabase.from("client_legal_entities").select("*").eq("client_id", id).maybeSingle(),
    supabase
      .from("policies")
      .select("policy_number, status, start_date, end_date, premium_gross, premium_net, risk_label, created_at")
      .eq("client_id", id),
    supabase
      .from("interactions")
      .select("interaction_type, subject, notes, interaction_date, follow_up_needed")
      .eq("client_id", id),
    supabase.from("client_tickets").select("subject, description, status, created_at, resolved_at").eq("client_id", id),
    supabase.from("incoming_calls").select("phone_number, created_at, notes").eq("client_id", id),
    supabase.from("documents").select("file_name, document_type, uploaded_at").eq("client_id", id),
    supabase.from("tasks").select("title, due_date, status, priority").eq("client_id", id),
  ]);

  if (!client) return new Response("Not found", { status: 404 });

  const payload = {
    exported_at: new Date().toISOString(),
    client,
    individual,
    legal_entity: legalEntity,
    policies: policies ?? [],
    interactions: interactions ?? [],
    tickets: tickets ?? [],
    incoming_calls: calls ?? [],
    documents: documents ?? [],
    tasks: tasks ?? [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-${client.client_code ?? id}-export.json"`,
    },
  });
}
