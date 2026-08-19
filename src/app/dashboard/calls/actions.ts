"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { normalizeGreekPhone } from "@/lib/phone";

// Same optional-notes update as clients/actions.ts's updateIncomingCallNotes
// (per-client tab), just revalidating the all-calls list page instead of a
// specific client page — the list also has to cover unmatched calls, which
// have no client page to revalidate.
export async function updateCallNotes(callId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const notes = (formData.get("notes") as string) || null;

  await supabase.from("incoming_calls").update({ notes }).eq("id", callId);

  revalidatePath("/dashboard/calls");
}

// Picks the right client for a call that matched more than one (a shared
// number). Beyond marking this one call, it upserts phone_owner_overrides
// so every future call from the same number resolves straight to this
// client without asking again — see /api/incoming-call.
export async function resolveIncomingCall(callId: string, clientId: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const [{ data: call }, { data: client }] = await Promise.all([
    supabase.from("incoming_calls").select("phone_number").eq("id", callId).single(),
    supabase.from("clients").select("display_name").eq("id", clientId).single(),
  ]);
  if (!call || !client) return { error: "Δεν βρέθηκαν τα στοιχεία της κλήσης." };

  await supabase
    .from("incoming_calls")
    .update({ client_id: clientId, client_name: client.display_name, needs_disambiguation: false })
    .eq("id", callId);

  const normalized = normalizeGreekPhone(call.phone_number);
  await supabase
    .from("phone_owner_overrides")
    .upsert(
      { phone_number: normalized, client_id: clientId, set_by: agencyUser.id, set_at: new Date().toISOString() },
      { onConflict: "phone_number" },
    );

  revalidatePath("/dashboard/calls");
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true as const, clientName: client.display_name as string | null };
}

// <form action> requires void | Promise<void> — used from the calls list's
// per-candidate resolve buttons, which don't need the return value.
export async function resolveIncomingCallForm(callId: string, clientId: string) {
  await resolveIncomingCall(callId, clientId);
}
