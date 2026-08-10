import "server-only";
import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

// Takes the caller's own already-authenticated client (not the admin
// client) so the insert goes through the same RLS the caller is already
// subject to — activity_log_insert just requires being an agency user,
// which every call site here already established via requireAgencyUser().
export async function logActivity(
  supabase: SupabaseClient,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    description: string;
    actorId: string;
  },
) {
  await supabase.from("activity_log").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    description: params.description,
    actor_id: params.actorId,
  });
}
