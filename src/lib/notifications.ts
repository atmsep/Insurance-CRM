import "server-only";
import type { createClient as createSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

export type NotifyParams = {
  recipientId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
};

// Fire-and-forget in-app notification. Takes the caller's own client (RLS
// insert only needs "is an agency user", same as activity_log) and never
// notifies someone about their own action — a person doesn't need telling
// about what they just did.
export async function notify(supabase: SupabaseClient, params: NotifyParams): Promise<void> {
  if (params.actorId && params.actorId === params.recipientId) return;
  await supabase.from("notifications").insert({
    recipient_id: params.recipientId,
    kind: params.kind,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    actor_id: params.actorId ?? null,
  });
}

// Same, for several recipients at once (one row each — "read" is per user).
export async function notifyMany(supabase: SupabaseClient, recipientIds: string[], params: Omit<NotifyParams, "recipientId">): Promise<void> {
  const targets = [...new Set(recipientIds)].filter((id) => id && id !== params.actorId);
  if (targets.length === 0) return;
  await supabase.from("notifications").insert(
    targets.map((recipientId) => ({
      recipient_id: recipientId,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      actor_id: params.actorId ?? null,
    })),
  );
}
